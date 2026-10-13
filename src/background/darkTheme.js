import {SET_BITRIX_DARK_THEME_MESSAGE_TYPE} from '../js/messages.js';

// «Тёмная тема Битрикса» не может жить в isolated.js, как остальные функции: тот стартует после загрузки
// страницы и чтения настроек, и страница успевала бы мелькнуть белой. Поэтому скрипт темы регистрируется
// как отдельный контент-скрипт на document_start — только пока функция включена.

const SCRIPT_ID = 'pts-bitrix-dark-theme';

// Те же порталы, что у основного контент-скрипта (isolated.js) из манифеста — списки не разойдутся.
// Ищем его по имени файла: после сборки путь меняется, но имя остаётся в нём
function getPortalMatches() {
  const contentScripts = chrome.runtime.getManifest().content_scripts;
  const isolatedScript = contentScripts.find((script) => script.js?.some((path) => path.includes('isolated')));
  return (isolatedScript ?? contentScripts[0]).matches;
}

function buildScriptConfig() {
  return {
    id: SCRIPT_ID,
    js: ['assets/bitrix-dark-theme.js'],
    matches: getPortalMatches(),
    runAt: 'document_start',
    allFrames: true,
    // Редактор комментариев и пустые iframe слайдеров — about:blank, без этого тема в них не попадает
    matchOriginAsFallback: true,
    world: 'ISOLATED',
  };
}

// Тема выключена кнопкой в шапке портала: опция при этом остаётся включённой — иначе пропала бы и сама кнопка
const PAUSED_STORAGE_KEY = 'bitrixDarkThemePaused';

// Подопция включена по умолчанию, а у тех, кто включил тему до её появления, ключа в настройках ещё нет
function isButtonEnabled(options) {
  return options?.bitrixDarkThemeButton !== false;
}

async function syncDarkTheme() {
  const {options, [PAUSED_STORAGE_KEY]: paused} = await chrome.storage.local.get(['options', PAUSED_STORAGE_KEY]);
  // Без кнопки снять паузу было бы нечем — тогда её не учитываем
  const enabled = Boolean(options?.bitrixDarkTheme) && !(paused && isButtonEnabled(options));
  const registered = await chrome.scripting.getRegisteredContentScripts({ids: [SCRIPT_ID]});

  if (enabled && registered.length) {
    // Регистрация переживает обновление расширения вместе со старыми настройками — освежаем её
    await chrome.scripting.updateContentScripts([buildScriptConfig()]);
  } else if (enabled) {
    await chrome.scripting.registerContentScripts([buildScriptConfig()]);
    await applyToOpenTabs(true);
  } else if (registered.length) {
    await chrome.scripting.unregisterContentScripts({ids: [SCRIPT_ID]});
    await applyToOpenTabs(false);
  }
}

// Скрипт темы, уже работающий в документе, переключается событием — так не приходится заново разбирать
// его мегабайты CSS. Выполняется на странице, поэтому всё нужное — внутри функции.
function toggleLoadedTheme(enabled) {
  if (!document.documentElement.hasAttribute('data-pts-bitrix-dark-theme')) return false;
  document.dispatchEvent(new CustomEvent('pts-bitrix-dark-theme-toggle', {detail: enabled}));
  return true;
}

async function applyToTab(tabId, enabled) {
  const results = await chrome.scripting.executeScript({
    target: {tabId, allFrames: true},
    func: toggleLoadedTheme,
    args: [enabled],
  });
  // Фреймы, загруженные без темы, получают сам скрипт — только при включении
  const frameIds = results.filter((result) => result.result === false).map((result) => result.frameId);
  if (!enabled || !frameIds.length) return;
  await chrome.scripting.executeScript({target: {tabId, frameIds}, files: buildScriptConfig().js});
}

// Регистрация действует только на новые загрузки — уже открытые вкладки портала переключаем на лету
async function applyToOpenTabs(enabled) {
  const tabs = await chrome.tabs.query({url: getPortalMatches()});
  // Вкладка могла выгрузиться или показывать страницу ошибки — остальные от этого переключаться не должны
  await Promise.allSettled(tabs.map((tab) => applyToTab(tab.id, enabled)));
}

// Синхронизации идут строго по очереди: при быстром переключении опции два параллельных вызова оба увидели бы
// «не зарегистрировано», и второй registerContentScripts упал бы на повторном id
let syncQueue = Promise.resolve();
function queueSync() {
  syncQueue = syncQueue
    .then(syncDarkTheme)
    .catch((error) => console.warn('[pts-plan] bitrixDarkTheme', error));
}

chrome.runtime.onInstalled.addListener(queueSync);
chrome.runtime.onStartup.addListener(queueSync);

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !changes.options) return;
  const {oldValue, newValue} = changes.options;
  const featureChanged = Boolean(oldValue?.bitrixDarkTheme) !== Boolean(newValue?.bitrixDarkTheme);
  if (!featureChanged && isButtonEnabled(oldValue) === isButtonEnabled(newValue)) return;

  // Включение функции в настройках означает «хочу тёмную тему» — старая пауза из кнопки не должна её глушить
  if (featureChanged && newValue?.bitrixDarkTheme) {
    await chrome.storage.local.remove(PAUSED_STORAGE_KEY);
  }
  queueSync();
});

async function setDarkThemeEnabled(enabled) {
  await chrome.storage.local.set({[PAUSED_STORAGE_KEY]: !enabled});
  queueSync();
  // Отвечаем кнопке, только когда тема уже переключена во вкладках — до этого она остаётся заблокированной
  await syncQueue;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== SET_BITRIX_DARK_THEME_MESSAGE_TYPE) return false;

  setDarkThemeEnabled(Boolean(message.enabled))
    .then(() => sendResponse({ok: true}))
    .catch((error) => sendResponse({ok: false, error: String(error)}));
  // Ответ асинхронный — держим канал открытым
  return true;
});
