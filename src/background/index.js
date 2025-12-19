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

  if (notificationMessage) {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('img/logo.png'),
      title: 'Pixel Plan Injection обновлён!',
      message: notificationMessage,
    });
  }
});
