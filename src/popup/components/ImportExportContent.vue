<script setup>
import { Button, Message, Textarea } from 'primevue';
import { ref, watch } from 'vue';

import optionsList, { optionTypes } from '../../js/options.js';

const props = defineProps({
  visible: Boolean,
});

const emit = defineEmits(['apply']);

const importExportJson = ref('');
const importError = ref('');
const copyDone = ref(false);
const resetConfirm = ref(false);

function getOptionsMap() {
  const result = {};
  function recursive(opts) {
    opts.forEach((option) => {
      switch (option.type) {
        case optionTypes.TEXT:
        case optionTypes.COLOR:
          result[option.key] = option.default || '';
          break;
        case optionTypes.NUMBER:
          result[option.key] = option.default || null;
          break;
        case optionTypes.MULTISELECT:
          result[option.key] = option.default ?? [];
          break;
        default:
          result[option.key] = option.default || false;
      }
      if (option.options) recursive(option.options);
    });
  }
  recursive(optionsList);
  return result;
}

watch(() => props.visible, async (val) => {
  if (!val) return;
  const all = await chrome.storage.local.get(null);
  const { sessionId: _sessionId, ...exportData } = all;
  importExportJson.value = JSON.stringify(exportData, null, 4);
  importError.value = '';
  copyDone.value = false;
  resetConfirm.value = false;
}, { immediate: true });

async function copySettings() {
  await navigator.clipboard.writeText(importExportJson.value);
  copyDone.value = true;
  setTimeout(() => { copyDone.value = false; }, 1500);
}

async function applyImport() {
  importError.value = '';

  if (!importExportJson.value.trim()) {
    importError.value = 'Поле обязательное';
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(importExportJson.value);
  } catch {
    importError.value = 'Не удалось разобрать JSON. Проверьте формат.';
    return;
  }

  const { sessionId: _sessionId, ...data } = parsed;

  if (data.options && typeof data.options === 'object') {
    const knownKeys = new Set(Object.keys(getOptionsMap()));
    data.options = Object.fromEntries(
      Object.entries(data.options).filter(([k]) => knownKeys.has(k)),
    );
  }

  const backup = await chrome.storage.local.get(null);
  await chrome.storage.local.clear();
  try {
    await chrome.storage.local.set(data);
  } catch {
    await chrome.storage.local.set(backup).catch(() => {});
    importError.value = 'Не удалось применить настройки.';
    return;
  }
  emit('apply', data.options ?? {});
}

async function resetSettings() {
  await chrome.storage.local.clear();
  location.reload();
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <Textarea
      v-model="importExportJson"
      :rows="8"
      fluid
      size="small"
      class="font-mono resize-none"
      spellcheck="false"
    />
    <Message
      v-if="importError"
      severity="error"
      size="small"
      :closable="false"
    >
      {{ importError }}
    </Message>
    <div class="flex gap-2 items-center">
      <Button
        :label="copyDone ? 'Скопировано!' : 'Скопировать'"
        :icon="copyDone ? 'pi pi-check' : 'pi pi-copy'"
        :severity="copyDone ? 'success' : 'secondary'"
        size="small"
        @click="copySettings"
      />
      <Button
        label="Применить"
        size="small"
        @click="applyImport"
      />
      <Button
        v-if="!resetConfirm"
        v-tooltip.bottom="'Полностью очистит хранилище расширения без возможности восстановления'"
        class="ml-auto"
        label="Сбросить настройки"
        icon="pi pi-trash"
        severity="danger"
        text
        size="small"
        @click="resetConfirm = true"
      />
      <template v-else>
        <Button
          class="ml-auto"
          label="Да, сбросить"
          icon="pi pi-trash"
          severity="danger"
          size="small"
          @click="resetSettings"
        />
        <Button
          label="Отмена"
          severity="secondary"
          text
          size="small"
          @click="resetConfirm = false"
        />
      </template>
    </div>
  </div>
</template>
