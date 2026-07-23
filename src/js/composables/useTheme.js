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

// chrome.storage.local асинхронный, поэтому настоящий режим темы приходит уже после первой
// отрисовки. Синхронный кэш в localStorage применяется прямо здесь (при инициализации модуля, до
// монтирования Vue) и убирает вспышку чужой темы при каждом открытии; loadMode() ниже вскоре
// сверяет его с реальным значением.
{
  const cachedMode = localStorage.getItem(STORAGE_KEY);
  applyTheme(MODES.includes(cachedMode) ? cachedMode : 'auto');
}

/**
 * Управляет переключателем темы в попапе и на странице «Что нового»: режим из трёх состояний
 * (`auto`/`light`/`dark`) хранится в `chrome.storage.local` и применяется классом `.dark` на
 * `<html>` — на него завязаны и вариант `dark:` из Tailwind, и `darkModeSelector: '.dark'` у
 * PrimeVue. Режим `auto` следует за `prefers-color-scheme` и реагирует на смену темы системы,
 * пока страница открыта.
 * @returns {{
 *   mode: import('vue').Ref<'auto'|'light'|'dark'>,
 *   icon: import('vue').ComputedRef<string>,
 *   tooltip: import('vue').ComputedRef<string>,
 *   cycleMode: () => void,
 * }} Текущий режим, его иконка и подсказка, а также переключение на следующий режим.
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
