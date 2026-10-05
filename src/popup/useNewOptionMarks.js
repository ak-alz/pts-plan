import {computed, ref} from 'vue';

import {INSTALLED_VERSION_STORAGE_KEY} from '../js/installInfo.js';
import allOptions from '../js/options.js';
import {compareVersions} from '../js/utils.js';

const SEEN_OPTIONS_STORAGE_KEY = 'seenNewOptions';

// Состояние общее для всех экземпляров OptionsTree (он рекурсивный) и для попапа, поэтому живёт
// на уровне модуля и загружается один раз
const seenKeys = ref(new Set());
const installedVersion = ref(null);
const loaded = ref(false);
let loadPromise = null;

const currentVersion = chrome.runtime.getManifest().version;

function collectOptions(options) {
  return options.flatMap((option) => [option, ...collectOptions(option.options ?? [])]);
}

const flatOptions = collectOptions(allOptions);

// Опция текущего релиза новая для всех, даже для только что установивших — им показываем, что
// появилось в последнем обновлении. Более ранние — только тем, кто установил расширение до них
function isFreshAddition(option) {
  if (!option.addedIn) return false;
  if (compareVersions(option.addedIn, currentVersion) === 0) return true;
  // Версия установки неизвестна (сброс настроек, старый импорт) — считаем, что поставили только что:
  // иначе точка загорелась бы у каждой опции с addedIn за всю историю
  return compareVersions(option.addedIn, installedVersion.value ?? currentVersion) > 0;
}

const unseenKeys = computed(() => {
  if (!loaded.value) return new Set();
  return new Set(flatOptions.filter((option) => isFreshAddition(option) && !seenKeys.value.has(option.key)).map((option) => option.key));
});

function handleStorageChanged(changes, area) {
  if (area !== 'local') return;
  if (changes[SEEN_OPTIONS_STORAGE_KEY]) seenKeys.value = new Set(changes[SEEN_OPTIONS_STORAGE_KEY].newValue ?? []);
  if (changes[INSTALLED_VERSION_STORAGE_KEY]) installedVersion.value = changes[INSTALLED_VERSION_STORAGE_KEY].newValue ?? null;
}

function load() {
  if (loadPromise) return loadPromise;

  // Слушатель — на всё время жизни страницы: попап и «Что нового» открыты одновременно, и отметка
  // в одном должна погасить точку в другом
  chrome.storage.onChanged.addListener(handleStorageChanged);
  loadPromise = chrome.storage.local.get([SEEN_OPTIONS_STORAGE_KEY, INSTALLED_VERSION_STORAGE_KEY]).then((stored) => {
    seenKeys.value = new Set(stored[SEEN_OPTIONS_STORAGE_KEY] ?? []);
    installedVersion.value = stored[INSTALLED_VERSION_STORAGE_KEY] ?? null;
    loaded.value = true;
  });
  return loadPromise;
}

function markSeen(keys) {
  const unseen = keys.filter((key) => unseenKeys.value.has(key));
  if (!unseen.length) return;

  const next = new Set([...seenKeys.value, ...unseen]);
  seenKeys.value = next;
  chrome.storage.local.set({[SEEN_OPTIONS_STORAGE_KEY]: [...next]});
}

/**
 * Красные точки у новых опций и подопций (флаг `addedIn` в options.js): какие ещё не просмотрены,
 * и как их отметить просмотренными — по наведению или все сразу.
 * @returns {{
 *   unseenCount: import('vue').ComputedRef<number>,
 *   hasUnseen: function(object): boolean,
 *   markOptionSeen: function(object, boolean): void,
 *   markAllSeen: function(): void,
 * }}
 */
export function useNewOptionMarks() {
  load();

  // Точка у родителя — пока не просмотрена она сама или хоть одна вложенная опция
  function hasUnseen(option) {
    return unseenKeys.value.has(option.key) || (option.options ?? []).some(hasUnseen);
  }

  // Вложенные опции видны только у включённой фичи — у выключенной навести на них нельзя, поэтому
  // наведение на неё гасит и их точки, иначе точка у родителя осталась бы навсегда
  function markOptionSeen(option, childrenVisible) {
    const keys = childrenVisible ? [option.key] : collectOptions([option]).map((item) => item.key);
    markSeen(keys);
  }

  function markAllSeen() {
    markSeen([...unseenKeys.value]);
  }

  return {
    unseenCount: computed(() => unseenKeys.value.size),
    hasUnseen,
    markOptionSeen,
    markAllSeen,
  };
}
