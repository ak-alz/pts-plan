import {DEFAULT_MODEL_VALUE, getModelPromptLength} from './aiModel.js';
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
// Предел сервиса и для изображения, и для документа
export const MAX_AI_ATTACHMENT_SIZE = 20 * 1024 * 1024;
// Расширения, которые сервис принимает в image_upload и file_upload, — он проверяет их по имени файла
const AI_IMAGE_FILE_RE = /\.(?:png|jpe?g|webp|gif)$/i;
// Изображение сервис принимает только по MIME части формы (без него молча выбрасывает), поэтому при
// пустом или общем типе файла (application/octet-stream) берём его по расширению
const AI_IMAGE_MIME_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const AI_DOCUMENT_FILE_RE = /\.(?:txt|pdf|html|csv|xlsx?|docx?)$/i;

// Ошибки API приходят телом ответа (см. разбор data.code ниже), поэтому HTTP-статус здесь
// намеренно не превращается в исключение — throwOnHttpError не включаем
function bgFetch(method, path, { body, files, params } = {}) {
  return backgroundFetch(method, `${BASE_URL}${path}`, { body, files, params });
}

/**
 * Каким вложением запроса к нейросети может уйти файл — по расширению, как его проверяет сервис.
 * @param {string} fileName - Имя файла.
 * @returns {'image'|'document'|null} `image` — изображение (`image_upload`, нужна нейросеть с `isVision`),
 * `document` — документ (`file_upload`, нужна нейросеть с `isFile`), `null` — сервис такой файл не примет.
 */
export function getAiAttachmentKind(fileName) {
  if (AI_IMAGE_FILE_RE.test(fileName ?? '')) return 'image';
  if (AI_DOCUMENT_FILE_RE.test(fileName ?? '')) return 'document';
  return null;
}

/**
 * Вложения к запросу из выбранных пользователем файлов: сервис принимает одно изображение и один
 * документ, поэтому берутся первые подходящие по расширению и размеру.
 * @param {File[]} files - Файлы в порядке, в котором их выбрали.
 * @returns {{image?: File, document?: File}} Вложения для `options` метода `chat()`.
 */
export function pickAiAttachments(files) {
  const findFirst = (kind) => files.find((file) => getAiAttachmentKind(file.name) === kind
    && file.size <= MAX_AI_ATTACHMENT_SIZE);
  const attachments = {image: findFirst('image'), document: findFirst('document')};
  return Object.fromEntries(Object.entries(attachments).filter(([, file]) => file));
}

function getAttachmentMimeType(key, file) {
  if (key !== 'image' || file.type.startsWith('image/')) return file.type;
  const extension = file.name.split('.').pop().toLowerCase();
  return AI_IMAGE_MIME_TYPES[extension] ?? file.type;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const ATTACHMENT_FIELDS = [
  { key: 'image', field: 'image_upload', flag: 'isVision', label: 'изображения' },
  { key: 'document', field: 'file_upload', flag: 'isFile', label: 'файлы' },
];

// Вложение, которое нейросеть не понимает, сервис молча выбрасывает — отсеиваем такие сами и
// предупреждаем, иначе пользователь будет думать, что нейросеть файл видела. Нейросети нет в
// справочнике (отключили) — вложения не готовим: chat() переключится на нейросеть по умолчанию
async function prepareAttachments(model, attachments) {
  if (!model.name) return undefined;

  const files = {};
  const skipped = [];
  for (const { key, field, flag, label } of ATTACHMENT_FIELDS) {
    const file = attachments[key];
    if (!file) continue;
    if (!model[flag]) {
      skipped.push(`«${file.name}» — нейросеть «${model.name}» не принимает ${label}.`);
      continue;
    }
    if (file.size > MAX_AI_ATTACHMENT_SIZE) {
      skipped.push(`«${file.name}» — больше 20 МБ.`);
      continue;
    }
    files[field] = { name: file.name, type: getAttachmentMimeType(key, file), base64: await blobToBase64(file) };
  }

  if (skipped.length) {
    showToast({
      severity: 'warn',
      summary: 'Файлы не переданы нейросети',
      detail: [...skipped, 'Нейросеть, которая принимает файлы, можно выбрать в профиле расширения.'].join(' '),
      life: 10000,
    });
  }
  return Object.keys(files).length ? files : undefined;
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

function joinPrompt(systemMessage, userPrompt) {
  return systemMessage ? `${systemMessage}\n\n---\n\n${userPrompt}` : userPrompt;
}

// Нейросети нет в справочнике — не узнать, примет ли она файлы, поэтому prepareAttachments() их не
// отправил; без предупреждения пользователь думал бы, что нейросеть их видела
function warnUncheckedAttachments(model, attachments) {
  const names = Object.values(attachments).filter(Boolean).map((file) => `«${file.name}»`);
  if (!names.length) return;
  showToast({
    severity: 'warn',
    summary: 'Файлы не переданы нейросети',
    detail: `${names.join(', ')} — не удалось проверить, принимает ли нейросеть «${model.value}» файлы: её нет в списке нейросетей Пиксель Тулс или список не загрузился.`,
    life: 10000,
  });
}

// Лимит у каждой нейросети свой (promptLength из справочника) — длиннее сервис не примет, поэтому
// хвост обрезаем и предупреждаем. Нейросети нет в справочнике (отключили) — отправляем как есть,
// сервис ответит -100 и chat() переключится на нейросеть по умолчанию
function fitPromptToModel(prompt, model, truncationHint) {
  if (!model.name) return prompt;
  const limit = getModelPromptLength(model);
  if (prompt.length <= limit) return prompt;

  showToast({
    severity: 'warn',
    summary: 'Запрос обрезан',
    detail: [
      `Нейросеть «${model.name}» принимает до ${limit.toLocaleString('ru-RU')} символов, а запрос — ${prompt.length.toLocaleString('ru-RU')}. Конец не попал в запрос.`,
      truncationHint,
      'Нейросеть с большим лимитом можно выбрать в профиле расширения.',
    ].filter(Boolean).join(' '),
    life: 10000,
  });
  return prompt.slice(0, limit);
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
   * @param {{truncationHint?: string, image?: File, document?: File}} [options] - `truncationHint` — что
   * посоветовать пользователю, если запрос не влез в лимит нейросети и его конец обрезан; `image` и
   * `document` — изображение и документ к запросу (по одному, см. `getAiAttachmentKind()`), уходят
   * только нейросети, которая их принимает.
   * @returns {Promise<string>} итоговый ответ ИИ.
   */
  async chat(userPrompt, systemMessage = '', onProgress = null, onStart = null, { truncationHint = '', ...attachments } = {}) {
    const fullPrompt = joinPrompt(systemMessage, userPrompt);

    const model = await this._resolveModel();
    let usedModel = model;
    let files = await prepareAttachments(model, attachments);
    let data = await this._createTask(fitPromptToModel(fullPrompt, model, truncationHint), model.value, files);

    // Выбранную нейросеть могли отключить в Пиксель Тулс уже после того, как её сохранили в
    // настройках, — молча возвращаемся на нейросеть по умолчанию, чтобы запрос не пропал
    if (isDisabledModelResponse(data)) {
      const defaultModel = await this._switchToDefaultModel(model.value);
      if (defaultModel) {
        usedModel = defaultModel;
        files = await prepareAttachments(defaultModel, attachments);
        data = await this._createTask(fitPromptToModel(fullPrompt, defaultModel, truncationHint), defaultModel.value, files);
      }
    }

    if (!data?.report_id) {
      throwIfAuthError(data);
      if (isDisabledModelResponse(data)) {
        throw new Error('Выбранная нейросеть недоступна — выберите другую в профиле расширения');
      }
      const detail = data?.details?.join(' ') ?? data?.error ?? JSON.stringify(data);
      throw new Error(detail);
    }
    if (!usedModel.name) warnUncheckedAttachments(usedModel, attachments);
    if (onStart) onStart(data.report_id);
    return this._poll(data.report_id, onProgress, null, files?.image_upload?.name ?? null);
  }

  /**
   * Сколько символов пользовательского промпта примет нейросеть, на которой уйдёт `chat()` этого
   * экземпляра, — чтобы подогнать данные под лимит заранее, а не терять хвост при обрезке.
   * @param {string} [systemMessage] - то же, что уйдёт в `chat()`: оно тоже занимает место в запросе.
   * @returns {Promise<number|null>} `null` — нейросети нет в справочнике (отключили или он не загрузился), лимит неизвестен.
   */
  async getPromptLengthLimit(systemMessage = '') {
    const model = await this._resolveModel();
    if (!model.name) return null;
    return getModelPromptLength(model) - joinPrompt(systemMessage, '').length;
  }

  _createTask(prompt, model, files) {
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
      files,
    });
  }

  // Один раз на экземпляр: getPromptLengthLimit() и следующий за ним chat() идут на одной нейросети
  _resolveModel() {
    this._modelPromise ??= this._loadModel().catch((error) => {
      this._modelPromise = null;
      throw error;
    });
    return this._modelPromise;
  }

  // Справочник запрашиваем и для явно выбранной нейросети — из него берётся её лимит длины запроса.
  // Выбранной в справочнике может не оказаться (отключили) — тогда идём без лимита, а запрос
  // вернёт код -100 и chat() переключится на нейросеть по умолчанию. Справочник не загрузился —
  // идём на выбранной так же без лимита; без выбранной (или с неверным ключом) идти не на чем
  async _loadModel() {
    const { options } = await chrome.storage.local.get(['options']);
    const selected = options?.pixelToolsAiModel;
    const isExplicit = selected && selected !== DEFAULT_MODEL_VALUE;
    try {
      const { models, defaultModel } = await getAiModels(this.apiKey);
      const value = isExplicit ? selected : defaultModel;
      return models.find((model) => model.value === value) ?? { value };
    } catch (error) {
      if (error.isAuthError || !isExplicit) throw error;
      console.warn('[PixelToolsApi] справочник нейросетей не загрузился', error);
      return { value: selected };
    }
  }

  async _switchToDefaultModel(disabledModel) {
    const { models, defaultModel } = await getAiModels(this.apiKey);
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
      summary: 'ИИ',
      detail: 'Выбранная нейросеть больше не доступна в Пиксель Тулс — запрос выполнен на нейросети по умолчанию.',
      life: 7000,
    });
    return models.find((model) => model.value === defaultModel);
  }

  /**
   * Продолжает опрос уже запущенной ранее ИИ-задачи (например, если виджет был закрыт до получения ответа).
   * @param {string} reportId - идентификатор задачи, полученный ранее через onStart в chat().
   * @param {(progress: number) => void} [onProgress] - вызывается при каждом обновлении прогресса.
   * @param {number} [initialProgress] - последнее известное значение прогресса; если передано, полоса продолжится с него, а не с нуля.
   * @returns {Promise<string>} итоговый ответ ИИ.
   */
  async resumeChat(reportId, onProgress = null, initialProgress = null) {
    return this._poll(reportId, onProgress, initialProgress);
  }

  // sentImageName — изображение, ушедшее с запросом: сервис возвращает его адрес в image_url ответа, а
  // если не принял (формат, сбой загрузки), молча отвечает без него — тогда предупреждаем сами
  async _poll(reportId, onProgress = null, initialProgress = null, sentImageName = null) {
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
        if (data?.response) {
          if (sentImageName && !data.image_url) {
            showToast({
              severity: 'warn',
              summary: 'Изображение не дошло до нейросети',
              detail: `Пиксель Тулс не принял «${sentImageName}» — ответ подготовлен без него.`,
              life: 10000,
            });
          }
          return data.response;
        }
        if (data?.error) throw new Error(data.error);
      }
      throw new Error('Превышено время ожидания ответа ИИ');
    } finally {
      if (progressTimer) clearInterval(progressTimer);
    }
  }
}
