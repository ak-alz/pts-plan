// «Тёмная тема Битрикса» не может жить в isolated.js, как остальные функции: тот стартует после загрузки
// страницы и чтения настроек, и страница успевала бы мелькнуть белой. Поэтому скрипт темы регистрируется
// как отдельный контент-скрипт на document_start — только пока функция включена.

const SCRIPT_ID = 'pts-bitrix-dark-theme';

async function syncDarkTheme() {
  const {options} = await chrome.storage.local.get(['options']);
  const enabled = Boolean(options?.bitrixDarkTheme);
  const registered = await chrome.scripting.getRegisteredContentScripts({ids: [SCRIPT_ID]});

  if (enabled && !registered.length) {
    await chrome.scripting.registerContentScripts([{
      id: SCRIPT_ID,
      js: ['assets/bitrix-dark-theme.js'],
      // Стили темы сняты с plan.pixelplus.ru — на других порталах Bitrix24 набор модулей другой
      matches: ['https://plan.pixelplus.ru/*'],
      runAt: 'document_start',
      allFrames: true,
      // Редактор комментариев и пустые iframe слайдеров — about:blank, без этого тема в них не попадает
      matchOriginAsFallback: true,
      world: 'ISOLATED',
    }]);
  } else if (!enabled && registered.length) {
    await chrome.scripting.unregisterContentScripts({ids: [SCRIPT_ID]});
  }
}

chrome.runtime.onInstalled.addListener(syncDarkTheme);
chrome.runtime.onStartup.addListener(syncDarkTheme);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.options) return;
  if (Boolean(changes.options.oldValue?.bitrixDarkTheme) === Boolean(changes.options.newValue?.bitrixDarkTheme)) return;
  syncDarkTheme().catch((error) => console.warn('[pts-plan] bitrixDarkTheme', error));
});
