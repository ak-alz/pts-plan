const SHOW_EVENT_NAME = 'pts-toast-show';
const REMOVE_EVENT_NAME = 'pts-toast-remove';
const CLOSED_EVENT_NAME = 'pts-toast-closed';

export const TOAST_GROUP = 'pts-global';

function dispatch(eventName, detail) {
  window.dispatchEvent(new CustomEvent(eventName, {detail}));
}

function subscribe(eventName, handler) {
  const listener = (event) => handler(event.detail);
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}

/**
 * Показывает всплывающее уведомление на общем для всего расширения хосте, который поднимает
 * `initToastHost()` (см. `./index.js`). Вместо прямого вызова `useToast()` шлёт `CustomEvent` на
 * `window`: вызывающие (и Vue-компоненты, и обычные JS-фичи) живут в разных экземплярах Vue на
 * странице и общего `ToastEventBus` у них нет.
 * @param {object} message - Опции сообщения PrimeVue (`severity`, `summary`, `detail`, `life`,
 * `links`, `id`, …) — тот же вид, что у `toast.add()`, но без `group`: его подставляет сам хост.
 * Передавайте `id`, если уведомление потом может понадобиться закрыть через `removeToast()`.
 */
export function showToast(message) {
  dispatch(SHOW_EVENT_NAME, message);
}

/**
 * Подписывает хост на вызовы `showToast()`.
 * @param {function(object): void} handler - Получает сообщение, переданное в `showToast()`.
 * @returns {function(): void} Отписка.
 */
export function onShowToast(handler) {
  return subscribe(SHOW_EVENT_NAME, handler);
}

/**
 * Закрывает уже показанное уведомление по `id` (тому же, что был передан в `showToast({id, …})`) —
 * например, чтобы убрать напоминание во всех вкладках, когда его закрыли в одной.
 * @param {string|number} id - `id` из исходного вызова `showToast({id, …})`.
 */
export function removeToast(id) {
  dispatch(REMOVE_EVENT_NAME, {id});
}

/**
 * Подписывает хост на вызовы `removeToast()`.
 * @param {function(string|number): void} handler - Получает `id`, переданный в `removeToast()`.
 * @returns {function(): void} Отписка.
 */
export function onRemoveToast(handler) {
  return subscribe(REMOVE_EVENT_NAME, (detail) => handler(detail.id));
}

/**
 * Сообщает, что уведомление закрылось — вручную или по истечении `life`. Имеет смысл только для
 * уведомлений с `id`: фичи, которым нужно отреагировать на закрытие (например, синхронизировать
 * его с другими вкладками), подписываются через `onToastClosed()`.
 * @param {object} message - Объект закрывшегося сообщения (в том же виде, что передавали в `showToast()`).
 */
export function notifyToastClosed(message) {
  dispatch(CLOSED_EVENT_NAME, message);
}

/**
 * Подписка на закрытие уведомлений (см. `notifyToastClosed()`).
 * @param {function(object): void} handler - Получает объект закрывшегося сообщения.
 * @returns {function(): void} Отписка.
 */
export function onToastClosed(handler) {
  return subscribe(CLOSED_EVENT_NAME, handler);
}
