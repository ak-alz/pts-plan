const BROWSER_NOTIFICATION_ID_PREFIX = 'pts-browser-notification';

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
  if (message.type !== 'pts-browser-notification') return false;

  if (isDuplicateNotification(message.dedupeKey, Date.now())) return false;

  // URL кодируется прямо в id уведомления, а не хранится в памяти service worker'а —
  // он может выгружаться между показом уведомления и кликом по нему
  const notificationId = `${BROWSER_NOTIFICATION_ID_PREFIX}:${encodeURIComponent(message.url ?? '')}:${Math.random().toString(36).slice(2)}`;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('img/logo.png'),
    title: message.title ?? 'Bitrix24',
    message: message.message ?? '',
  });

  return false;
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith(`${BROWSER_NOTIFICATION_ID_PREFIX}:`)) return;

  chrome.notifications.clear(notificationId);

  const url = decodeURIComponent(notificationId.split(':')[1] ?? '');
  if (!url) return;

  const [existingTab] = await chrome.tabs.query({url});
  if (existingTab) {
    await chrome.windows.update(existingTab.windowId, {focused: true});
    await chrome.tabs.update(existingTab.id, {active: true});
  } else {
    await chrome.tabs.create({url});
  }
});
