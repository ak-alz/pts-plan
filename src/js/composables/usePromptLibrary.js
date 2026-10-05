import {debounce} from 'lodash-es';
import {computed, onUnmounted, ref} from 'vue';

import {buildDefaultPromptTemplate, buildPromptFromTemplate, renderPromptTemplatePreview} from '../aiPromptLibrary.js';

function getStorageKey(spec) {
  return `ai-prompts-${spec.key}`;
}

/**
 * Свои промпты одной AI-фичи: список, выбранный, создание/правка/удаление. Хранятся в
 * `chrome.storage.local` под `ai-prompts-<spec.key>` и попадают в экспорт настроек — ими можно
 * поделиться. `activeId: null` — стандартный промпт фичи.
 * @param {import('../aiPromptLibrary.js').PromptSpec} spec - Описание промпта фичи.
 * @returns {{
 *   spec: import('../aiPromptLibrary.js').PromptSpec,
 *   prompts: import('vue').Ref<Array<{id: string, name: string, template: string}>>,
 *   activeId: import('vue').Ref<string|null>,
 *   activePrompt: import('vue').ComputedRef<{id: string, name: string, template: string}|null>,
 *   defaultTemplate: string,
 *   ready: Promise<void>,
 *   buildActivePrompt: function(Record<string, any>): (string|null),
 *   previewActivePrompt: function(): (string|null),
 *   createPrompt: function({name: string, template: string}): string,
 *   updatePrompt: function(string, object): void,
 *   deletePrompt: function(string): void,
 *   setActive: function(string|null): void,
 * }}
 */
export function usePromptLibrary(spec) {
  const storageKey = getStorageKey(spec);
  const prompts = ref([]);
  const activeId = ref(null);
  const defaultTemplate = buildDefaultPromptTemplate(spec);

  function applyStored(stored) {
    prompts.value = Array.isArray(stored?.prompts) ? stored.prompts : [];
    activeId.value = stored?.activeId ?? null;
  }

  // Запуск AI сразу после открытия виджета не должен уйти со стандартным промптом только потому,
  // что выбранный ещё не дочитан из storage — фичи ждут ready перед сборкой промпта
  const ready = chrome.storage.local.get(storageKey).then((stored) => applyStored(stored[storageKey]));

  function handleStorageChanged(changes, area) {
    if (area === 'local' && changes[storageKey]) applyStored(changes[storageKey].newValue);
  }
  chrome.storage.onChanged.addListener(handleStorageChanged);
  onUnmounted(() => chrome.storage.onChanged.removeListener(handleStorageChanged));

  // Правка шаблона идёт на каждый символ — пишем в storage с задержкой. JSON-круговорот снимает
  // реактивные Proxy с вложенных объектов, иначе chrome.storage сохранил бы массив как объект
  const persist = debounce(() => {
    chrome.storage.local.set({[storageKey]: JSON.parse(JSON.stringify({prompts: prompts.value, activeId: activeId.value}))});
  }, 300);

  // Пустой шаблон считаем отсутствующим — иначе нейросеть получила бы пустой запрос
  const activePrompt = computed(() => prompts.value.find((prompt) => prompt.id === activeId.value && prompt.template.trim()) ?? null);

  function buildActivePrompt(values) {
    return activePrompt.value ? buildPromptFromTemplate(activePrompt.value.template, values) : null;
  }

  function previewActivePrompt() {
    return activePrompt.value ? renderPromptTemplatePreview(activePrompt.value.template, spec.variables) : null;
  }

  function createPrompt({name, template}) {
    const id = crypto.randomUUID();
    prompts.value = [...prompts.value, {id, name, template}];
    persist();
    return id;
  }

  function updatePrompt(id, patch) {
    prompts.value = prompts.value.map((prompt) => (prompt.id === id ? {...prompt, ...patch} : prompt));
    persist();
  }

  function deletePrompt(id) {
    prompts.value = prompts.value.filter((prompt) => prompt.id !== id);
    if (activeId.value === id) activeId.value = null;
    persist();
  }

  function setActive(id) {
    activeId.value = id;
    persist();
  }

  return {
    spec,
    prompts,
    activeId,
    activePrompt,
    defaultTemplate,
    ready,
    buildActivePrompt,
    previewActivePrompt,
    createPrompt,
    updatePrompt,
    deletePrompt,
    setActive,
  };
}
