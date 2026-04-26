function compareVersions(a, b) {
  const aParts = a.split('.').map((part) => parseInt(part, 10) || 0);
  const bParts = b.split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < length; i++) {
    const diff = (aParts[i] || 0) - (bParts[i] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== 'update') return;

  const previousVersion = details.previousVersion;
  if (!previousVersion) return;

  let needsSave = false;
  let notificationMessage = null;

  if (previousVersion.startsWith('1.')) {
    await chrome.storage.local.clear();

    notificationMessage = 'Настройки сброшены для корректной работы новой версии. Зайдите в настройки и выберите пресет заново.';
  }

  if (previousVersion.startsWith('2.0.')) {
    const {options} = await chrome.storage.local.get(['options']);

    if (options && typeof options === 'object') {
      if ('mentionColor' in options) {
        delete options.mentionColor;
        needsSave = true;
      }
      if ('mentionColorBorder' in options) {
        delete options.mentionColorBorder;
        needsSave = true;
      }

      if ('userName' in options && options.userName && typeof options.userName === 'string') {
        const parts = options.userName.trim().split(/\s+/);

        if (parts.length >= 1) {
          options.userFirstName = parts[0];
          options.userLastName = parts.slice(1).join(' ') || '';
          delete options.userName;
          needsSave = true;
        }
      }
    }

    if (needsSave) {
      await chrome.storage.local.set({options});
      notificationMessage = 'Устаревшие настройки удалены для оптимизации. Проверьте опции, если нужно.';
    }
  }

  if (compareVersions(previousVersion, '2.7.4') < 0) {
    const {options} = await chrome.storage.local.get(['options']);

    if (options?.removeSystemNotifications) {
      options.removeSystemNotificationsSystem = true;
      options.removeSystemNotificationsChanges = true;
      options.removeSystemNotificationsClosed = true;
      await chrome.storage.local.set({options});
    }
  }

  if (notificationMessage) {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('img/logo.png'),
      title: 'Pixel Plan Injection обновлён!',
      message: notificationMessage,
    });
  }

  const currentVersion = chrome.runtime.getManifest().version;
  const [prevMajor, prevMinor] = previousVersion.split('.');
  const [curMajor, curMinor] = currentVersion.split('.');

  if (curMajor !== prevMajor || curMinor !== prevMinor) {
    chrome.tabs.create({ url: chrome.runtime.getURL('whats-new.html') });
  }
});
