import {DEFAULT_MODEL_VALUE} from './aiModel.js';
import {backgroundFetch} from './backgroundFetch.js';
import {showToast} from './toastHost/showToast.js';

const BASE_URL = 'https://tools.pixelplus.ru/api';
const PRIORITY = 1000;
// Документация метода просит опрашивать результат не чаще одного раза в 5 секунд
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
// Насколько показанный прогресс может уйти вперёд последнего значения от сервера и с каким шагом он
// туда доползает: за один интервал опроса добираем ровно PROGRESS_LEAD_MAX процентов
const PROGRESS_LEAD_MAX = 4;
const PROGRESS_STEP_MS = POLL_INTERVAL_MS / PROGRESS_LEAD_MAX;
const PROGRESS_MAX = 99;

// Ошибки API приходят телом ответа (см. разбор data.code ниже), поэтому HTTP-статус здесь
// намеренно не превращается в исключение — throwOnHttpError не включаем
function bgFetch(method, path, { body, params } = {}) {
  return backgroundFetch(method, `${BASE_URL}${path}`, { body, params });
}

// code -1 (ключ не передан) и -2 (ключ не найден или недействителен) — ошибки аутентификации
function throwIfAuthError(data) {
  const code = Number(data?.code);
  if (code !== -1 && code !== -2) return;
  const error = new Error('Неверный API-ключ');
  error.isAuthError = true;
  throw error;
}

// Отключённая или неизвестная модель — код -100 с описанием проблемы в details
function isDisabledModelResponse(data) {
  return Number(data?.code) === -100
    && (data?.details ?? []).some((detail) => /модел/i.test(detail));
}

/**
 * Возвращает нейросети, доступные API-ключу (метод `/aicontent` с `models=1`). Задача не создаётся,
 * лимиты не списываются. Состав зависит от тарифа ключа и меняется на стороне Пиксель Тулс без
 * предупреждения, поэтому список нигде не сохраняется, а запрашивается перед использованием.
 * @param {string} apiKey - API-ключ Пиксель Тулс.
 * @returns {Promise<{models: Array<object>, defaultModel: string}>} Нейросети, пригодные для режима
 * чат-бота, и значение той, что предвыбрана в самом инструменте.
 */
export async function getAiModels(apiKey) {
  const data = await bgFetch('GET', '/aicontent', {
    params: { key: apiKey, models: 1 },
  });
  throwIfAuthError(data);

  // Расширение ставит задачи только в режиме chat_bot — модели без этого флага нам не подходят
  const models = (data?.models ?? []).filter((model) => model.isChatBot);
  if (!models.length) {
    const detail = data?.details?.join(' ') ?? data?.error;
    throw new Error(detail ?? 'Пиксель Тулс не вернул ни одной доступной нейросети');
  }

  const isDefaultAvailable = models.some((model) => model.value === data.default);
  return { models, defaultModel: isDefaultAvailable ? data.default : models[0].value };
}

export class PixelToolsApi {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Ставит задачу в режиме чат-бота и дожидается ответа нейросети.
   * @param {string} userPrompt - основной промпт.
   * @param {string} [systemMessage] - вводная часть, приклеивается к промпту сверху.
   * @param {(progress: number) => void} [onProgress] - вызывается при каждом обновлении прогресса.
   * @param {(reportId: string) => void} [onStart] - получает идентификатор созданной задачи.
   * @returns {Promise<string>} итоговый ответ AI.
   */
  async chat(userPrompt, systemMessage = '', onProgress = null, onStart = null) {
    const fullPrompt = systemMessage
      ? `${systemMessage}\n\n---\n\n${userPrompt}`
      : userPrompt;

    const model = await this._resolveModel();
    let data = await this._createTask(fullPrompt, model);

    // Выбранную нейросеть могли отключить в Пиксель Тулс уже после того, как её сохранили в
    // настройках, — молча возвращаемся на нейросеть по умолчанию, чтобы запрос не пропал
    if (isDisabledModelResponse(data)) {
      const defaultModel = await this._switchToDefaultModel(model);
      if (defaultModel) data = await this._createTask(fullPrompt, defaultModel);
    }

    if (!data?.report_id) {
      throwIfAuthError(data);
      if (isDisabledModelResponse(data)) {
        throw new Error('Выбранная нейросеть недоступна — выберите другую в профиле расширения');
      }
      const detail = data?.details?.join(' ') ?? data?.error ?? JSON.stringify(data);
      throw new Error(detail);
    }
    if (onStart) onStart(data.report_id);
    return this._poll(data.report_id, onProgress);
  }

  _createTask(prompt, model) {
    const hid = Math.floor(Math.random() * 1e10);
    return bgFetch('POST', '/aicontent', {
      params: { key: this.apiKey },
      body: {
        part: 'chat_bot',
        model,
        priority: PRIORITY,
        request_field: prompt,
        hid,
      },
    });
  }

  async _resolveModel() {
    const { options } = await chrome.storage.local.get(['options']);
    const model = options?.pixelToolsAiModel;
    if (model && model !== DEFAULT_MODEL_VALUE) return model;

    const { defaultModel } = await getAiModels(this.apiKey);
    return defaultModel;
  }

  async _switchToDefaultModel(disabledModel) {
    const { defaultModel } = await getAiModels(this.apiKey);
    // Отключили саму нейросеть по умолчанию — повторять запрос на ней же бессмысленно
    if (defaultModel === disabledModel) return null;

    // Транзакций у chrome.storage нет, а options лежат одним объектом — читаем вплотную перед
    // записью, чтобы окно между ними было минимальным. Попап при этом слушает storage.onChanged
    // (см. PopupApp.vue) и подхватывает сброс, а не возвращает отключённую модель обратно
    const { options } = await chrome.storage.local.get(['options']);
    await chrome.storage.local.set({
      options: { ...options, pixelToolsAiModel: DEFAULT_MODEL_VALUE },
    });
    showToast({
      severity: 'warn',
      summary: 'AI',
      detail: 'Выбранная нейросеть больше не доступна в Пиксель Тулс — запрос выполнен на нейросети по умолчанию.',
      life: 7000,
    });
    return defaultModel;
  }

  /**
   * Продолжает опрос уже запущенной ранее AI-задачи (например, если виджет был закрыт до получения ответа).
   * @param {string} reportId - идентификатор задачи, полученный ранее через onStart в chat().
   * @param {(progress: number) => void} [onProgress] - вызывается при каждом обновлении прогресса.
   * @param {number} [initialProgress] - последнее известное значение прогресса; если передано, полоса продолжится с него, а не с нуля.
   * @returns {Promise<string>} итоговый ответ AI.
   */
  async resumeChat(reportId, onProgress = null, initialProgress = null) {
    return this._poll(reportId, onProgress, initialProgress);
  }

  async _poll(reportId, onProgress = null, initialProgress = null) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    // Сервер отвечает раз в POLL_INTERVAL_MS, поэтому между опросами прогресс подкручиваем сами —
    // иначе полоса стоит на месте по пять секунд и дёргается редкими скачками. Вперёд последнего
    // реального значения уходим не больше чем на PROGRESS_LEAD_MAX, чтобы не обгонять настоящий прогресс
    let serverProgress = initialProgress ?? 0;
    let shownProgress = initialProgress ?? 1;
    let progressTimer = null;

    if (onProgress) {
      onProgress(shownProgress);
      progressTimer = setInterval(() => {
        if (shownProgress >= Math.min(serverProgress + PROGRESS_LEAD_MAX, PROGRESS_MAX)) return;
        shownProgress += 1;
        onProgress(shownProgress);
      }, PROGRESS_STEP_MS);
    }

    try {
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const data = await bgFetch('GET', '/aicontent', {
          params: { key: this.apiKey, report_id: reportId },
        });
        if (Number(data?.code) === 50) {
          if (data.progress != null) {
            serverProgress = data.progress;
            // Назад прогресс не отматываем: подкрученное значение могло уже обогнать серверное
            if (onProgress && serverProgress > shownProgress) {
              shownProgress = serverProgress;
              onProgress(shownProgress);
            }
          }
          continue;
        }
        if (data?.response) return data.response;
        if (data?.error) throw new Error(data.error);
      }
      throw new Error('Превышено время ожидания ответа AI');
    } finally {
      if (progressTimer) clearInterval(progressTimer);
    }
  }
}
