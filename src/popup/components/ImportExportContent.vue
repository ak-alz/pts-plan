<script setup>
import { Button, Message, Textarea } from 'primevue';
import { ref, watch } from 'vue';

import { getDefaultOptions } from '../../js/options.js';

const props = defineProps({
  visible: Boolean,
});

const emit = defineEmits(['apply']);

const importExportJson = ref('');
const importError = ref('');
const copyDone = ref(false);
const resetConfirm = ref(false);

// Технические поля, восстанавливаемые из самого Bitrix, и личный API-ключ: выгрузку принято
// пересылать коллеге, а ключ вводится в профиле под скрытым полем именно потому, что он личный
const PRIVATE_STORAGE_KEYS = ['sessionId', 'bitrixOrigin'];
const PRIVATE_OPTION_KEYS = ['pixelToolsApiKey'];

// Производные и временные ключи: кэш аналитики (у «Динамики задач» это сотни килобайт на группу) и
// номер запущенного AI-запроса. Это не настройки — в выгрузке они только раздувают текст, который
// принято пересылать коллеге, а чужой кэш и чужой номер запроса ему всё равно бесполезны
const DERIVED_STORAGE_KEY_PATTERNS = [/-cache-/, /-ai-job-/];

function isDerivedKey(key) {
  return DERIVED_STORAGE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function withoutKeys(source, keys) {
  return Object.fromEntries(Object.entries(source ?? {}).filter(([key]) => !keys.includes(key)));
}

function withoutDerivedKeys(source) {
  return Object.fromEntries(Object.entries(source ?? {}).filter(([key]) => !isDerivedKey(key)));
}

watch(() => props.visible, async (val) => {
  if (!val) return;
  const all = await chrome.storage.local.get(null);
  const exportData = withoutDerivedKeys(withoutKeys(all, PRIVATE_STORAGE_KEYS));
  if (exportData.options) {
    exportData.options = withoutKeys(exportData.options, PRIVATE_OPTION_KEYS);
  }
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

  const data = withoutDerivedKeys(withoutKeys(parsed, PRIVATE_STORAGE_KEYS));

  if (data.options && typeof data.options === 'object') {
    const knownKeys = new Set(Object.keys(getDefaultOptions()));
    data.options = Object.fromEntries(
      Object.entries(data.options).filter(([k]) => knownKeys.has(k)),
    );
  }

  const backup = await chrome.storage.local.get(null);

  // Приватных полей в выгрузке нет, поэтому переносим их из текущего хранилища: без этого clear()
  // ниже стёр бы уже введённый API-ключ и адрес сайта при импорте чужого набора настроек
  PRIVATE_STORAGE_KEYS.forEach((key) => {
    if (backup[key] !== undefined) data[key] = backup[key];
  });
  PRIVATE_OPTION_KEYS.forEach((key) => {
    if (backup.options?.[key] && !data.options?.[key]) {
      data.options = { ...(data.options ?? {}), [key]: backup.options[key] };
    }
  });

  // Свой кэш аналитики переносим как есть: он не часть настроек, но clear() ниже стёр бы его,
  // и виджету пришлось бы выкачивать историю задач заново
  Object.entries(backup)
    .filter(([key]) => isDerivedKey(key))
    .forEach(([key, value]) => { data[key] = value; });

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
    <p class="m-0 text-xs text-surface-500 dark:text-surface-400">
      API-ключ для AI-функций в выгрузку не попадает — этими настройками можно спокойно поделиться.
      При импорте ваш уже введённый ключ сохраняется. Данные, которые виджеты сохраняют для скорости,
      в выгрузку тоже не попадают и при импорте остаются вашими.
    </p>
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
