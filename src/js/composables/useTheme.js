import {computed, onMounted, onUnmounted, ref, watch} from 'vue';

const STORAGE_KEY = 'themeMode';
const MODES = ['auto', 'light', 'dark'];

const ICONS = {auto: 'pi-desktop', light: 'pi-sun', dark: 'pi-moon'};
const TOOLTIPS = {
  auto: 'Тема: авто (по системе)',
  light: 'Тема: светлая',
  dark: 'Тема: тёмная',
};

const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(mode) {
  const isDark = mode === 'dark' || (mode === 'auto' && darkMediaQuery.matches);
  document.documentElement.classList.toggle('dark', isDark);
}

// chrome.storage.local is async, so the authoritative mode only arrives after the first render —
// applying a synchronous localStorage cache here (module init, before Vue mounts) avoids a flash
// of the wrong theme on every open. loadMode() below reconciles it against the real value shortly after.
{
  const cachedMode = localStorage.getItem(STORAGE_KEY);
  applyTheme(MODES.includes(cachedMode) ? cachedMode : 'auto');
}

/**
 * Manages the popup/whats-new theme toggle: a 3-state mode (`auto`/`light`/`dark`) persisted in
 * `chrome.storage.local`, applied by toggling the `.dark` class on `<html>` — both `tailwindcss`'s
 * `dark:` variant and PrimeVue's `darkModeSelector: '.dark'` key off that same class. `auto` follows
 * `prefers-color-scheme` and stays live if the OS theme changes while the page is open.
 * @returns {{
 *   mode: import('vue').Ref<'auto'|'light'|'dark'>,
 *   icon: import('vue').ComputedRef<string>,
 *   tooltip: import('vue').ComputedRef<string>,
 *   cycleMode: () => void,
 * }} Current mode plus its icon/tooltip and a function to cycle to the next mode.
 */
export function useTheme() {
  const mode = ref('auto');

  async function loadMode() {
    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    mode.value = MODES.includes(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : 'auto';
    applyTheme(mode.value);
    localStorage.setItem(STORAGE_KEY, mode.value);
  }

  function cycleMode() {
    const nextIndex = (MODES.indexOf(mode.value) + 1) % MODES.length;
    mode.value = MODES[nextIndex];
  }

  function handleMediaChange() {
    if (mode.value === 'auto') applyTheme('auto');
  }

  function handleStorageChanged(changes, area) {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    mode.value = MODES.includes(changes[STORAGE_KEY].newValue) ? changes[STORAGE_KEY].newValue : 'auto';
  }

  onMounted(() => {
    loadMode();
    darkMediaQuery.addEventListener('change', handleMediaChange);
    chrome.storage.onChanged.addListener(handleStorageChanged);
  });

  onUnmounted(() => {
    darkMediaQuery.removeEventListener('change', handleMediaChange);
    chrome.storage.onChanged.removeListener(handleStorageChanged);
  });

  watch(mode, (value) => {
    applyTheme(value);
    localStorage.setItem(STORAGE_KEY, value);
    chrome.storage.local.set({[STORAGE_KEY]: value});
  });

  return {
    mode,
    icon: computed(() => ICONS[mode.value]),
    tooltip: computed(() => TOOLTIPS[mode.value]),
    cycleMode,
  };
}
