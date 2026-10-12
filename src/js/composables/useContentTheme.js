import {onMounted, onUnmounted, ref} from 'vue';

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

  // Тема включается только перезагрузкой страницы, поэтому класс её скрипта за время жизни виджета не меняется
  const isBitrixDarkTheme = document.documentElement.classList.contains('pts-bitrix-dark');

  async function loadMode() {
    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    isDark.value = stored[STORAGE_KEY] === 'dark' || isBitrixDarkTheme;
  }

  function handleStorageChanged(changes, area) {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    isDark.value = changes[STORAGE_KEY].newValue === 'dark' || isBitrixDarkTheme;
  }

  onMounted(() => {
    loadMode();
    chrome.storage.onChanged.addListener(handleStorageChanged);
  });

  onUnmounted(() => {
    chrome.storage.onChanged.removeListener(handleStorageChanged);
  });

  return {isDark};
}
