// Isolated-сторона моста к визуальному BBCode-редактору Bitrix. Сам мост —
// src/content-scripts/text-editor-bridge.js, инжектится в main world при первом обращении.
import {loadMainWorldScript} from './mainWorldScript.js';

const MOUNT_KEY = 'PTS_TEXT_EDITOR_MOUNT';
const MOUNT_RESULT_KEY = 'PTS_TEXT_EDITOR_MOUNT_RESULT';
const SET_TEXT_KEY = 'PTS_TEXT_EDITOR_SET_TEXT';
const DESTROY_KEY = 'PTS_TEXT_EDITOR_DESTROY';
const CHANGE_KEY = 'PTS_TEXT_EDITOR_CHANGE';
const SET_EDITABLE_KEY = 'PTS_TEXT_EDITOR_SET_EDITABLE';
const GET_TEXT_KEY = 'PTS_TEXT_EDITOR_GET_TEXT';
const TEXT_RESULT_KEY = 'PTS_TEXT_EDITOR_TEXT_RESULT';
const GET_TEXT_TIMEOUT_MS = 1000;
// Первый раз Bitrix догружает библиотеку редактора с сервера — это не мгновенно
const MOUNT_TIMEOUT_MS = 10000;

function isOwnMessage(event) {
  return event.source === window && event.origin === window.location.origin;
}

function post(message) {
  window.postMessage(message, window.location.origin);
}

/**
 * Рисует визуальный BBCode-редактор Bitrix (`ui.text-editor`) в переданном контейнере.
 * @param {HTMLElement} container Пустой элемент, уже вставленный в документ
 * @param {object} options
 * @param {string} [options.content] Начальный текст в BBCode
 * @param {string} [options.placeholder]
 * @param {number} [options.minHeight]
 * @param {number} [options.maxHeight]
 * @param {(text: string) => void} options.onChange Вызывается с BBCode при каждом изменении текста
 * @returns {Promise<{getText: () => Promise<string|null>, setText: (text: string) => void,
 *   setEditable: (editable: boolean) => void, destroy: () => void}|null>}
 *   Управление редактором, либо `null`, если на этом портале редактор недоступен. `getText` читает
 *   текст прямо из редактора — `onChange` приходит с небольшой задержкой и может отставать от ввода
 */
export async function mountTextEditor(container, {content, placeholder, minHeight, maxHeight, onChange}) {
  if (!await loadMainWorldScript('src/content-scripts/text-editor-bridge.js')) return null;

  const editorId = crypto.randomUUID();
  container.id ||= `pts-text-editor-${editorId}`;

  function onMessage(event) {
    if (!isOwnMessage(event)) return;
    if (event.data?.key !== CHANGE_KEY || event.data.editorId !== editorId) return;
    onChange(String(event.data.text ?? ''));
  }

  const mountError = await new Promise((resolve) => {
    function finish(error) {
      clearTimeout(timeoutId);
      window.removeEventListener('message', onMountResult);
      resolve(error);
    }

    function onMountResult(event) {
      if (!isOwnMessage(event)) return;
      if (event.data?.key !== MOUNT_RESULT_KEY || event.data.editorId !== editorId) return;
      finish(event.data.error);
    }

    const timeoutId = setTimeout(() => finish('Мост редактора не ответил'), MOUNT_TIMEOUT_MS);

    window.addEventListener('message', onMountResult);
    // Подписка на изменения — до монтирования, чтобы не потерять ни одного сообщения
    window.addEventListener('message', onMessage);
    post({
      key: MOUNT_KEY,
      editorId,
      containerId: container.id,
      content,
      placeholder,
      minHeight,
      maxHeight,
    });
  });

  if (mountError) {
    window.removeEventListener('message', onMessage);
    // По таймауту редактор мог всё же появиться позже — не оставляем его висеть
    post({key: DESTROY_KEY, editorId});
    console.warn('[pts-plan] text-editor-bridge', mountError);
    return null;
  }

  return {
    getText() {
      const requestId = crypto.randomUUID();
      return new Promise((resolve) => {
        function finish(text) {
          clearTimeout(timeoutId);
          window.removeEventListener('message', onTextResult);
          resolve(text);
        }

        function onTextResult(event) {
          if (!isOwnMessage(event)) return;
          if (event.data?.key !== TEXT_RESULT_KEY || event.data.requestId !== requestId) return;
          finish(String(event.data.text ?? ''));
        }

        const timeoutId = setTimeout(() => finish(null), GET_TEXT_TIMEOUT_MS);
        window.addEventListener('message', onTextResult);
        post({key: GET_TEXT_KEY, editorId, requestId});
      });
    },
    setText(text) {
      post({key: SET_TEXT_KEY, editorId, text});
    },
    setEditable(editable) {
      post({key: SET_EDITABLE_KEY, editorId, editable});
    },
    destroy() {
      window.removeEventListener('message', onMessage);
      post({key: DESTROY_KEY, editorId});
    },
  };
}
