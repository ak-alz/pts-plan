const BASE_URL = 'https://tools.pixelplus.ru/api';
const MODEL = 'gpt-5.3-chat-latest';
const PRIORITY = 1000;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const PROGRESS_RAMP_MAX = 5;
const PROGRESS_RAMP_STEP_MS = 400;

async function bgFetch(method, path, { body, params } = {}) {
  const response = await chrome.runtime.sendMessage({
    type: 'pixeltools-api-fetch',
    method,
    url: `${BASE_URL}${path}`,
    body,
    params,
  });
  if (!response) throw new Error('Нет ответа от фонового скрипта');
  if (response.error) throw new Error(response.error);
  return response.data;
}

export class PixelToolsApi {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async chat(userPrompt, systemMessage = '', onProgress = null, onStart = null) {
    const hid = Math.floor(Math.random() * 1e10);
    const fullPrompt = systemMessage
      ? `${systemMessage}\n\n---\n\n${userPrompt}`
      : userPrompt;

    const data = await bgFetch('POST', '/aicontent', {
      params: { key: this.apiKey },
      body: {
        part: 'chat_bot',
        model: MODEL,
        priority: PRIORITY,
        request_field: fullPrompt,
        hid,
      },
    });

    if (!data?.report_id) {
      // code -1 (нет ключа) и -2 (невалидный ключ) — ошибки аутентификации
      if (data?.code === -1 || data?.code === -2) {
        const error = new Error('Неверный API-ключ');
        error.isAuthError = true;
        throw error;
      }
      const detail = data?.details?.join(' ') ?? data?.error ?? JSON.stringify(data);
      throw new Error(detail);
    }
    if (onStart) onStart(data.report_id);
    return this._poll(data.report_id, onProgress);
  }

  /**
   * Продолжает опрос уже запущенной ранее AI-задачи (например, если виджет был закрыт до получения ответа).
   * @param {string} reportId - идентификатор задачи, полученный ранее через onStart в chat().
   * @param {(progress: number) => void} [onProgress] - вызывается при каждом обновлении прогресса.
   * @param {number} [initialProgress] - последнее известное значение прогресса; если передано, плавный старт пропускается.
   * @returns {Promise<string>} итоговый ответ AI.
   */
  async resumeChat(reportId, onProgress = null, initialProgress = null) {
    return this._poll(reportId, onProgress, initialProgress);
  }

  async _poll(reportId, onProgress = null, initialProgress = null) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    // Плавный старт: анимированно ведём прогресс с 1% до PROGRESS_RAMP_MAX, пока не придёт первое реальное
    // значение от сервера — иначе пользователь несколько секунд смотрит на пустой прогресс-бар.
    let rampTimer = null;
    let rampedProgress = initialProgress ?? 1;
    if (onProgress) {
      onProgress(rampedProgress);
      if (initialProgress == null) {
        rampTimer = setInterval(() => {
          if (rampedProgress >= PROGRESS_RAMP_MAX) {
            clearInterval(rampTimer);
            rampTimer = null;
            return;
          }
          rampedProgress += 1;
          onProgress(rampedProgress);
        }, PROGRESS_RAMP_STEP_MS);
      }
    }

    try {
      while (Date.now() < deadline) {
        await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
        const data = await bgFetch('GET', '/aicontent', {
          params: { key: this.apiKey, report_id: reportId },
        });
        if (data?.code === 50) {
          if (rampTimer) {
            clearInterval(rampTimer);
            rampTimer = null;
          }
          if (onProgress && data.progress != null) onProgress(data.progress);
          continue;
        }
        if (data?.response) return data.response;
        if (data?.error) throw new Error(data.error);
      }
      throw new Error('Превышено время ожидания ответа AI');
    } finally {
      if (rampTimer) clearInterval(rampTimer);
    }
  }
}
