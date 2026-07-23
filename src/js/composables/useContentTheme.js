import {onMounted, onUnmounted, ref} from 'vue';

const STORAGE_KEY = 'themeMode';

/**
 * Реактивный признак тёмной темы для виджетов в контент-скриптах. Повторяет класс `.pts-dark`,
 * который `isolated.js` вешает на `<html>` страницы Bitrix. Нужен там, где цвета выбираются в JS
 * (инлайновые стили), — компонентам на токенах PrimeVue и варианте `dark:` из Tailwind он не нужен,
 * они реагируют на класс сами. Считается только явно выбранный режим `dark`, как и в `isolated.js`:
 * `auto` и `light` дают светлую тему, потому что сама страница Bitrix всегда светлая.
 * @returns {{isDark: import('vue').Ref<boolean>}} Активна ли сейчас тёмная тема.
 */
export function useContentTheme() {
  const isDark = ref(false);

  async function loadMode() {
    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    isDark.value = stored[STORAGE_KEY] === 'dark';
  }

  function handleStorageChanged(changes, area) {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    isDark.value = changes[STORAGE_KEY].newValue === 'dark';
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
