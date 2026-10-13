import {onMounted, onUnmounted, ref} from 'vue';

import {isBitrixDarkThemeActive, onBitrixDarkThemeChange} from '../utils.js';

const STORAGE_KEY = 'themeMode';

/**
 * Реактивный признак тёмной темы для виджетов в контент-скриптах. Повторяет класс `.pts-dark`,
 * который `isolated.js` вешает на `<html>` страницы Bitrix. Нужен там, где цвета выбираются в JS
 * (инлайновые стили), — компонентам на токенах PrimeVue и варианте `dark:` из Tailwind он не нужен,
 * они реагируют на класс сами. Правило то же, что в `isolated.js`: тёмная тема — только явно выбранный
 * режим `dark` или работающая на странице «Тёмная тема Битрикса» (класс `.pts-bitrix-dark` от её скрипта);
 * `auto` и `light` дают светлую, потому что без неё сама страница Bitrix светлая.
 * @returns {{isDark: import('vue').Ref<boolean>}} Активна ли сейчас тёмная тема.
 */
export function useContentTheme() {
  const isDark = ref(false);

  let themeMode;
  let stopWatchingBitrixDarkTheme = null;

  function update() {
    isDark.value = themeMode === 'dark' || isBitrixDarkThemeActive();
  }

  async function loadMode() {
    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    themeMode = stored[STORAGE_KEY];
    update();
  }

  function handleStorageChanged(changes, area) {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    themeMode = changes[STORAGE_KEY].newValue;
    update();
  }

  onMounted(() => {
    loadMode();
    chrome.storage.onChanged.addListener(handleStorageChanged);
    stopWatchingBitrixDarkTheme = onBitrixDarkThemeChange(update);
  });

  onUnmounted(() => {
    chrome.storage.onChanged.removeListener(handleStorageChanged);
    stopWatchingBitrixDarkTheme?.();
  });

  return {isDark};
}
