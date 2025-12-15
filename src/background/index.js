chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;

    // Если обновились с версии < 2.0
    if (previousVersion && previousVersion.startsWith('1.')) {
      await chrome.storage.local.clear();
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('img/logo.png'),
        title: 'Pixel Plan Injection обновлён!',
        message: 'Настройки сброшены для корректной работы новой версии. Зайдите в настройки и выберите пресет заново.',
      });
    }
  }
});
