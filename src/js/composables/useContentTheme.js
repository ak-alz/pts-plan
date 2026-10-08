import {onMounted, onUnmounted, ref} from 'vue';

const STORAGE_KEY = 'themeMode';

/**
 * Реактивный признак тёмной темы для виджетов в контент-скриптах. Повторяет класс `.pts-dark`,
 * который `isolated.js` вешает на `<html>` страницы Bitrix. Нужен там, где цвета выбираются в JS
 * (инлайновые стили), — компонентам на токенах PrimeVue и варианте `dark:` из Tailwind он не нужен,
 * они реагируют на класс сами. Правило то же, что в `isolated.js`: тёмная тема — только явно выбранный
 * режим `dark` или включённая «Тёмная тема Битрикса»; `auto` и `light` дают светлую, потому что без неё
 * сама страница Bitrix светлая.
 * @returns {{isDark: import('vue').Ref<boolean>}} Активна ли сейчас тёмная тема.
 */
export function useContentTheme() {
  const isDark = ref(false);

  async function loadMode() {
    const stored = await chrome.storage.local.get([STORAGE_KEY, 'options']);
    isDark.value = stored[STORAGE_KEY] === 'dark' || Boolean(stored.options?.bitrixDarkTheme);
  }

  function handleStorageChanged(changes, area) {
    if (area !== 'local' || (!changes[STORAGE_KEY] && !changes.options)) return;
    loadMode();
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
