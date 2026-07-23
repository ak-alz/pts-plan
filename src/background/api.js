import {BACKGROUND_FETCH_MESSAGE_TYPE} from '../js/messages.js';

// Адреса, куда расширению вообще есть смысл ходить из фона. Проверка нужна потому, что здесь
// действуют host_permissions: без белого списка обработчик стал бы открытым прокси, которым можно
// сходить куда угодно с правами расширения
const ALLOWED_URL_PREFIXES = [
  'https://tools.pixelplus.ru/api',
  'https://docs.google.com/spreadsheets/',
];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== BACKGROUND_FETCH_MESSAGE_TYPE) return false;

  const { method, url, body, params, responseType } = message;
  const fullUrl = params ? `${url}?${new URLSearchParams(params)}` : url;

  if (!ALLOWED_URL_PREFIXES.some((prefix) => fullUrl.startsWith(prefix))) {
    sendResponse({ error: 'Адрес запроса не разрешён расширением' });
    return false;
  }

  fetch(fullUrl, {
    method: method ?? 'GET',
    headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
    body: body ? new URLSearchParams(body).toString() : undefined,
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
