// Типы сообщений chrome.runtime между контент-скриптами и service worker'ом.
// Общий модуль, потому что тип — это контракт двух сторон: разъехавшиеся литералы в отправителе
// и в слушателе не сломают сборку, но сообщение молча перестанет доходить.

// Просьба показать системное (браузерное) уведомление. Отправляют browser-notifications и
// call-notifications, обрабатывает src/background/browserNotifications.js.
export const BROWSER_NOTIFICATION_MESSAGE_TYPE = 'pts-browser-notification';

// Просьба сходить в стороннюю систему за данными. Выполняет запрос service worker
// (src/background/api.js): только там работают host_permissions расширения, а контент-скрипт ходит
// от имени страницы Bitrix и упирается в CORS чужого домена. Отправляют PixelToolsApi и
// sprint-priorities — через общую обёртку src/js/backgroundFetch.js.
export const BACKGROUND_FETCH_MESSAGE_TYPE = 'pts-background-fetch';
