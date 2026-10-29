import {BACKGROUND_FETCH_MESSAGE_TYPE} from '../js/messages.js';

// Адреса, куда расширению вообще есть смысл ходить из фона. Проверка нужна потому, что здесь
// действуют host_permissions: без белого списка обработчик стал бы открытым прокси, которым можно
// сходить куда угодно с правами расширения
const ALLOWED_URL_PREFIXES = [
  'https://tools.pixelplus.ru/api',
  'https://docs.google.com/spreadsheets/',
];

// Файлы приходят base64-строкой (Blob через сообщения не передаётся) и собираются в форму здесь.
// Content-Type с границей multipart fetch для FormData выставляет сам
function buildRequestInit(body, files) {
  if (files) {
    const formData = new FormData();
    Object.entries(body ?? {}).forEach(([field, value]) => formData.append(field, value));
    Object.entries(files).forEach(([field, file]) => {
      const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
      formData.append(field, new Blob([bytes], { type: file.type }), file.name);
    });
    return { body: formData };
  }
  if (!body) return {};
  return {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== BACKGROUND_FETCH_MESSAGE_TYPE) return false;

  const { method, url, body, files, params, responseType } = message;
  const fullUrl = params ? `${url}?${new URLSearchParams(params)}` : url;

  if (!ALLOWED_URL_PREFIXES.some((prefix) => fullUrl.startsWith(prefix))) {
    sendResponse({ error: 'Адрес запроса не разрешён расширением' });
    return false;
  }

  fetch(fullUrl, {
    method: method ?? 'GET',
    ...buildRequestInit(body, files),
  })
    .then(async (response) => {
      const data = responseType === 'text' ? await response.text() : await response.json();
      // Код ответа отдаём вместе с данными: часть API описывает проблему телом ответа, поэтому
      // решение «считать ли это ошибкой» остаётся за вызывающим (см. backgroundFetch)
      sendResponse({ data, status: response.status, ok: response.ok });
    })
    .catch((error) => sendResponse({ error: error.message }));

  return true; // держим канал открытым для async ответа
});
