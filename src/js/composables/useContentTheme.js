import {onMounted, onUnmounted, ref} from 'vue';

const STORAGE_KEY = 'themeMode';

/**
 * Reactive dark-mode flag for content-script widgets. Mirrors the `.pts-dark` class that
 * `isolated.js` toggles on the Bitrix page's `<html>` — use it in components that pick colors
 * in JS (inline styles) instead of relying on PrimeVue tokens or Tailwind's `dark:` variant,
 * which already react to that class on their own. Only the explicit `dark` mode counts, same
 * as `isolated.js` — `auto`/`light` both resolve to light, since the Bitrix page itself always
 * stays light.
 * @returns {{isDark: import('vue').Ref<boolean>}} Whether the dark theme is currently active.
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
