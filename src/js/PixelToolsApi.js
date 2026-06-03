const BASE_URL = 'https://tools.pixelplus.ru/api';
const MODEL = 'gpt-5.3-chat-latest';
const PRIORITY = 1000;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

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

  async chat(userPrompt, systemMessage = '', onProgress = null) {
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
    return this._poll(data.report_id, onProgress);
  }

  async _poll(reportId, onProgress = null) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
      const data = await bgFetch('GET', '/aicontent', {
        params: { key: this.apiKey, report_id: reportId },
      });
      if (data?.code === 50) {
        if (onProgress && data.progress != null) onProgress(data.progress);
        continue;
      }
      if (data?.response) return data.response;
      if (data?.error) throw new Error(data.error);
    }
    throw new Error('Превышено время ожидания ответа AI');
  }
}
