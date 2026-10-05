import {INSTALLED_VERSION_STORAGE_KEY} from '../js/installInfo.js';
import {compareVersions} from '../js/utils.js';

// С какой версии пользователь начал пользоваться расширением — от неё считаются новые опции
// (красные точки в попапе). При обновлении точной версии установки уже не узнать: берём ту, с
// которой обновились, — всё, что появилось позже неё, пользователь точно ещё не видел
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== 'install' && details.reason !== 'update') return;

  const stored = await chrome.storage.local.get([INSTALLED_VERSION_STORAGE_KEY]);
  if (stored[INSTALLED_VERSION_STORAGE_KEY]) return;

  const installedVersion = details.reason === 'install' ? chrome.runtime.getManifest().version : details.previousVersion;
  if (installedVersion) await chrome.storage.local.set({[INSTALLED_VERSION_STORAGE_KEY]: installedVersion});
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return;

  // Новый юзер: сразу открываем «Что нового» с авто-открытием быстрой настройки.
  chrome.tabs.create({ url: chrome.runtime.getURL('whats-new.html?setup=1') });
});

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

  if (compareVersions(previousVersion, '2.7.6') < 0) {
    await chrome.storage.local.remove('taskSearchFavorites');
  }

  if (compareVersions(previousVersion, '2.12.0') < 0) {
    // Ключи настроек task-analysis содержат id группы, поэтому нужен весь storage целиком
    const all = await chrome.storage.local.get(null);
    const savedFilter = all['notification-details-filter'];

    // Старый формат — одиночный выбор (groupId/highlightAttribute — строка). Оборачиваем в
    // массивы (новый формат — мультивыбор) и полностью заменяем значение, без старых полей
    if (savedFilter && !Array.isArray(savedFilter.groupIds)) {
      await chrome.storage.local.set({
        'notification-details-filter': {
          groupIds: savedFilter.groupId ? [savedFilter.groupId] : [],
          highlightAttributes: savedFilter.highlightAttribute ? [savedFilter.highlightAttribute] : [],
        },
      });
    }

    // task-analysis: «Исключить хотфиксы» переименована в «Учитывать хотфиксы в данных» (полярность
    // инвертирована — старое значение переносим с отрицанием), а «Сравнивать с пред. периодом» убрана —
    // сравнение теперь всегда включено, галка больше не существует. Обе правки — для каждой группы отдельно
    const taskAnalysisUpdates = {};
    Object.keys(all)
      .filter((key) => key.startsWith('task-analysis-settings-'))
      .forEach((key) => {
        const groupSettings = all[key];
        if (!groupSettings || typeof groupSettings !== 'object') return;
        if (!('defaultExcludeHotfixes' in groupSettings) && !('defaultCompareWithPrev' in groupSettings)) return;

        const {defaultExcludeHotfixes, defaultCompareWithPrev: _defaultCompareWithPrev, ...rest} = groupSettings;
        taskAnalysisUpdates[key] = {
          ...rest,
          ...(defaultExcludeHotfixes !== undefined ? {defaultIncludeHotfixes: rest.defaultIncludeHotfixes ?? !defaultExcludeHotfixes} : {}),
        };
      });
    if (Object.keys(taskAnalysisUpdates).length) await chrome.storage.local.set(taskAnalysisUpdates);
  }

  if (notificationMessage) {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('img/logo.png'),
      title: 'Pixel Plan Injection обновлён!',
      message: notificationMessage,
      silent: true,
    });
  }

  const currentVersion = chrome.runtime.getManifest().version;
  const [prevMajor, prevMinor] = previousVersion.split('.');
  const [curMajor, curMinor] = currentVersion.split('.');

  if (curMajor !== prevMajor || curMinor !== prevMinor) {
    const {disableAutoWhatsNew} = await chrome.storage.local.get(['disableAutoWhatsNew']);
    if (!disableAutoWhatsNew) {
      chrome.tabs.create({ url: chrome.runtime.getURL('whats-new.html') });
    }
  }
});
