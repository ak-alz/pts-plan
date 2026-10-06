// Isolated-сторона моста к редактору комментария Bitrix. Сам мост — src/content-scripts/editor-bridge.js,
// он инжектится в main world при первом обращении: постоянно грузить его на каждой странице незачем.
import {loadMainWorldScript} from './mainWorldScript.js';

const REQUEST_KEY = 'PTS_EDITOR_INSERT';
const RESPONSE_KEY = 'PTS_EDITOR_INSERT_RESULT';
const RESPONSE_TIMEOUT_MS = 2000;

/**
 * ID формы постформы Bitrix — это id её DOM-узла, но какой именно из предков им окажется, зависит
 * от шаблона: отдаём мосту все и даём ему проверить каждый.
 * @param {Element} form Любой элемент внутри формы комментария
 * @returns {string[]} ID предков снизу вверх, включая сам элемент
 */
function getFormIds(form) {
  const ids = [];

  for (let node = form; node; node = node.parentElement) {
    if (node.id) ids.push(node.id);
  }

  return ids;
}

/**
 * Вставляет текст (в том числе BBCode-упоминания вида `[USER=1]Имя[/USER]`) в редактор комментария
 * Bitrix через мост в main world. Не отправляет комментарий — только подставляет текст в поле.
 * @param {Element} form Любой элемент внутри формы комментария
 * @param {string} text Текст комментария в BBCode
 * @returns {Promise<boolean>} `true`, если текст вставлен (или уже был в поле)
 */
export async function insertCommentText(form, text) {
  if (!form || !text) return false;
  if (!await loadMainWorldScript('src/content-scripts/editor-bridge.js')) return false;

  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    function finish(result, error) {
      clearTimeout(timeoutId);
      window.removeEventListener('message', onMessage);
      if (error) console.warn('[pts-plan] editor-bridge', error);
      resolve(result);
    }

    function onMessage(event) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.key !== RESPONSE_KEY || event.data.requestId !== requestId) return;

      finish(!event.data.error, event.data.error);
    }

    const timeoutId = setTimeout(() => finish(false, 'Мост редактора не ответил'), RESPONSE_TIMEOUT_MS);

    window.addEventListener('message', onMessage);
    window.postMessage({
      key: REQUEST_KEY,
      requestId,
      formIds: getFormIds(form),
      text,
    }, window.location.origin);
  });
}
