import {BROWSER_NOTIFICATION_MESSAGE_TYPE} from '../js/messages.js';

// Пространство имён id уведомлений этого расширения: по нему onClicked отличает свои уведомления
// от чужих (совпадает с типом сообщения — это одна и та же фича, просто в двух ролях)
const BROWSER_NOTIFICATION_ID_PREFIX = BROWSER_NOTIFICATION_MESSAGE_TYPE;

// Одно и то же событие (напоминание о встрече или обычный Bitrix-баллон) почти одновременно
// прилетает из каждой открытой вкладки Bitrix — гасим повтор по dedupeKey, который присылает
// сама фича (call-notifications — reminderKey встречи, browser-notifications — хэш текста баллона).
// Service worker может выгружаться и терять карту, но окно гонки между вкладками — секунды, поэтому хватает
const DEDUP_WINDOW_MS = 60_000;
const recentDedupeKeys = new Map();

function isDuplicateNotification(dedupeKey, now) {
  if (!dedupeKey) return false;
  for (const [key, shownAt] of recentDedupeKeys) {
    if (now - shownAt > DEDUP_WINDOW_MS) recentDedupeKeys.delete(key);
  }
  if (recentDedupeKeys.has(dedupeKey)) return true;
  recentDedupeKeys.set(dedupeKey, now);
  return false;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== BROWSER_NOTIFICATION_MESSAGE_TYPE) return false;

  if (isDuplicateNotification(message.dedupeKey, Date.now())) return false;

  // URL кодируется прямо в id уведомления, а не хранится в памяти service worker'а —
  // он может выгружаться между показом уведомления и кликом по нему
  const notificationId = `${BROWSER_NOTIFICATION_ID_PREFIX}:${encodeURIComponent(message.url ?? '')}:${Math.random().toString(36).slice(2)}`;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('img/logo.png'),
    title: message.title ?? 'Bitrix24',
    message: message.message ?? '',
    silent: !!message.silent,
  });

  return false;
});

// tabs.query сопоставляет фрагмент (#…) не буквально, а игнорирует его — повторяем это поведение
function withoutFragment(url) {
  const fragmentIndex = url.indexOf('#');
  return fragmentIndex === -1 ? url : url.slice(0, fragmentIndex);
}

// Ищем вкладку сравнением строк, а не фильтром tabs.query({url}): там url трактуется как match
// pattern, поэтому легальная в адресе звёздочка превратилась бы в шаблон и сфокусировала чужую
// вкладку вместо нужной. У вкладок вне host_permissions (сторонний сервис созвонов) url пустой —
// такие просто не найдутся. Клик по уведомлению обязан открыть ссылку в любом случае, поэтому
// любая осечка здесь — просто повод открыть новую вкладку
async function focusTabWithUrl(url) {
  try {
    const target = withoutFragment(url);
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs.find((tab) => tab.url && withoutFragment(tab.url) === target);
    if (!existingTab) return false;

    // Вкладку могли закрыть между поиском и активацией — тогда тоже открываем новую
    await chrome.windows.update(existingTab.windowId, {focused: true});
    await chrome.tabs.update(existingTab.id, {active: true});
    return true;
  } catch {
    return false;
  }
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith(`${BROWSER_NOTIFICATION_ID_PREFIX}:`)) return;

  chrome.notifications.clear(notificationId);

  const url = decodeURIComponent(notificationId.split(':')[1] ?? '');
  if (!url) return;

  if (await focusTabWithUrl(url)) return;

  await chrome.tabs.create({url}).catch((error) => console.warn(error));
});
