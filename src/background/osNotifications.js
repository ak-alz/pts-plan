const OS_NOTIFICATION_ID_PREFIX = 'pts-os-notification';

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'pts-os-notification') return false;

  // URL кодируется прямо в id уведомления, а не хранится в памяти service worker'а —
  // он может выгружаться между показом уведомления и кликом по нему
  const notificationId = `${OS_NOTIFICATION_ID_PREFIX}:${encodeURIComponent(message.url ?? '')}:${Math.random().toString(36).slice(2)}`;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('img/logo.png'),
    title: message.title ?? 'Bitrix24',
    message: message.message ?? '',
  });

  return false;
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith(`${OS_NOTIFICATION_ID_PREFIX}:`)) return;

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
