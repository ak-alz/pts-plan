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

async function syncDarkTheme() {
  const {options} = await chrome.storage.local.get(['options']);
  const enabled = Boolean(options?.bitrixDarkTheme);
  const registered = await chrome.scripting.getRegisteredContentScripts({ids: [SCRIPT_ID]});

  if (enabled && registered.length) {
    // Регистрация переживает обновление расширения вместе со старыми настройками — освежаем её
    await chrome.scripting.updateContentScripts([buildScriptConfig()]);
  } else if (enabled) {
    await chrome.scripting.registerContentScripts([buildScriptConfig()]);
  } else if (registered.length) {
    await chrome.scripting.unregisterContentScripts({ids: [SCRIPT_ID]});
  }
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

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.options) return;
  if (Boolean(changes.options.oldValue?.bitrixDarkTheme) === Boolean(changes.options.newValue?.bitrixDarkTheme)) return;
  queueSync();
});
