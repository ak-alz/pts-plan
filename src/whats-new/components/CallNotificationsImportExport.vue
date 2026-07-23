<script setup>
import {Button, Dialog, Message, Textarea} from 'primevue';
import {ref, watch} from 'vue';

import {normalizeImportedMeetings} from '../../js/actions/call-notifications/meetingsEngine.js';
import {
  ACTIVE_REMINDERS_STORAGE_KEY,
  DEFAULT_SETTINGS,
  MEETINGS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  SHOWN_REMINDERS_STORAGE_KEY,
} from '../../js/actions/call-notifications/variables.js';

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['update:visible', 'imported', 'reset']);

const text = ref('');
const importError = ref('');
const copyDone = ref(false);
const resetConfirm = ref(false);
const loadedSettings = ref({...DEFAULT_SETTINGS});

async function refreshText() {
  const stored = await chrome.storage.local.get([MEETINGS_STORAGE_KEY, SETTINGS_STORAGE_KEY]);
  loadedSettings.value = {...DEFAULT_SETTINGS, ...stored[SETTINGS_STORAGE_KEY]};
  text.value = JSON.stringify({meetings: stored[MEETINGS_STORAGE_KEY] ?? [], ...loadedSettings.value}, null, 4);
}

watch(() => props.visible, (value) => {
  if (!value) return;
  importError.value = '';
  copyDone.value = false;
  resetConfirm.value = false;
  refreshText();
});

async function copyText() {
  await navigator.clipboard.writeText(text.value);
  copyDone.value = true;
  setTimeout(() => {
    copyDone.value = false;
  }, 1500);
}

async function applyImport() {
  importError.value = '';

  if (!text.value.trim()) {
    importError.value = 'Поле обязательное';
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(text.value);
  } catch {
    importError.value = 'Не удалось разобрать JSON. Проверьте формат.';
    return;
  }

  const {meetings: rawMeetings, ...rest} = parsed;
  const dataToStore = {};

  // Текст правится руками, поэтому встречи проверяем перед записью: запись без времени или типа
  // никогда не сработает и не почистится сама, зато навсегда останется в списке
  const {meetings, skipped} = normalizeImportedMeetings(rawMeetings);
  if (Array.isArray(rawMeetings)) {
    if (!meetings.length && skipped) {
      importError.value = 'Ни одну встречу не удалось разобрать: проверьте тип, дату и время.';
      return;
    }
    dataToStore[MEETINGS_STORAGE_KEY] = meetings;
  }

  const settingsUpdate = Object.fromEntries(Object.entries(rest).filter(([key]) => key in DEFAULT_SETTINGS));
  if (Object.keys(settingsUpdate).length) {
    dataToStore[SETTINGS_STORAGE_KEY] = {...loadedSettings.value, ...settingsUpdate};
  }

  await chrome.storage.local.set(dataToStore);
  emit('imported', {imported: meetings.length, skipped});
  emit('update:visible', false);
}

async function resetSettings() {
  await chrome.storage.local.remove([
    MEETINGS_STORAGE_KEY,
    SETTINGS_STORAGE_KEY,
    SHOWN_REMINDERS_STORAGE_KEY,
    ACTIVE_REMINDERS_STORAGE_KEY,
  ]);
  resetConfirm.value = false;
  emit('reset');
  emit('update:visible', false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Импорт / экспорт встреч и настроек"
    modal
    dismissable-mask
    :draggable="false"
    :style="{width: '480px'}"
    @update:visible="(value) => emit('update:visible', value)"
  >
    <div class="flex flex-col gap-3">
      <Textarea
        v-model="text"
        :rows="10"
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
          @click="copyText"
        />
        <Button
          label="Применить"
          size="small"
          @click="applyImport"
        />
        <Button
          v-if="!resetConfirm"
          v-tooltip.bottom="'Полностью очистит встречи и настройки этой функции без возможности восстановления'"
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
  </Dialog>
</template>
