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
 * Shows a toast on the shared extension-wide toast host mounted once by `initToastHost()`
 * (see `./index.js`). Dispatches a `CustomEvent` on `window` instead of calling PrimeVue's
 * `useToast()` directly — callers (Vue components and plain vanilla-JS features alike) live
 * in separate Vue app instances on the page and don't share a `ToastEventBus`.
 * @param {object} message - PrimeVue toast message options (`severity`, `summary`, `detail`,
 * `life`, `links`, `id`, ...) — same shape as `toast.add()`, minus `group` (added by the host
 * itself). Pass an `id` if the toast may need to be closed later via `removeToast()`.
 */
export function showToast(message) {
  dispatch(SHOW_EVENT_NAME, message);
}

/**
 * Subscribes the toast host to `showToast()` calls.
 * @param {function(object): void} handler - Called with the message passed to `showToast()`.
 * @returns {function(): void} Unsubscribes the listener.
 */
export function onShowToast(handler) {
  return subscribe(SHOW_EVENT_NAME, handler);
}

/**
 * Closes an already-shown toast by `id` (the same `id` passed to `showToast({id, ...})`) —
 * e.g. to close a reminder toast in every open tab once it's been dismissed in one of them.
 * @param {string|number} id - The `id` given to the original `showToast({id, ...})` call.
 */
export function removeToast(id) {
  dispatch(REMOVE_EVENT_NAME, {id});
}

/**
 * Subscribes the toast host to `removeToast()` calls.
 * @param {function(string|number): void} handler - Called with the `id` passed to `removeToast()`.
 * @returns {function(): void} Unsubscribes the listener.
 */
export function onRemoveToast(handler) {
  return subscribe(REMOVE_EVENT_NAME, (detail) => handler(detail.id));
}

/**
 * Notifies callers that a toast was closed (manually or via its `life` timeout). Only useful
 * for toasts shown with an `id` — features that need to react to dismissal (e.g. syncing the
 * closed state to other open tabs) subscribe via `onToastClosed()`.
 * @param {object} message - The closed toast's message object (same shape passed to `showToast()`).
 */
export function notifyToastClosed(message) {
  dispatch(CLOSED_EVENT_NAME, message);
}

/**
 * Subscribes to toast-closed notifications (see `notifyToastClosed()`).
 * @param {function(object): void} handler - Called with the closed toast's message object.
 * @returns {function(): void} Unsubscribes the listener.
 */
export function onToastClosed(handler) {
  return subscribe(CLOSED_EVENT_NAME, handler);
}
