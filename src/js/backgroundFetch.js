import {BACKGROUND_FETCH_MESSAGE_TYPE} from './messages.js';

/**
 * Выполняет запрос к стороннему сервису руками service worker'а (см. src/background/api.js).
 * Прямой `fetch` из контент-скрипта идёт от имени страницы Bitrix и подчиняется CORS чужого домена —
 * host_permissions расширения на контент-скрипты не распространяются. Список разрешённых адресов
 * задан в самом обработчике, поэтому произвольный URL сюда передать нельзя.
 * @param {'GET'|'POST'} method - HTTP-метод.
 * @param {string} url - Адрес без query-параметров (они передаются отдельно, см. `params`).
 * @param {object} [options]
 * @param {object} [options.body] - Тело запроса; отправляется как `application/x-www-form-urlencoded`.
 * @param {object} [options.params] - Query-параметры.
 * @param {'json'|'text'} [options.responseType] - Как разобрать ответ. По умолчанию `json`.
 * @param {boolean} [options.throwOnHttpError] - Бросать ошибку при ответе не-2xx. По умолчанию нет:
 * часть API отдаёт осмысленное описание проблемы телом ответа с кодом ошибки, и вызывающий разбирает его сам.
 * @returns {Promise<any>} Разобранный ответ сервиса.
 */
export async function backgroundFetch(method, url, {body, params, responseType = 'json', throwOnHttpError = false} = {}) {
  const response = await chrome.runtime.sendMessage({
    type: BACKGROUND_FETCH_MESSAGE_TYPE,
    method,
    url,
    body,
    params,
    responseType,
  });

  if (!response) throw new Error('Нет ответа от фонового скрипта');
  if (response.error) throw new Error(response.error);
  if (throwOnHttpError && !response.ok) throw new Error(`Ошибка запроса: ${response.status}`);

  return response.data;
}
