<script setup>
import { Button, InputText, ToggleSwitch } from 'primevue';
import { reactive } from 'vue';

import FormField from '../../../ui/FormField.vue';
import { DEFAULT_ARCHIVE_NAME_TEMPLATE } from '../variables.js';

const props = defineProps({
  initial: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['success']);

const form = reactive({
  archiveNameTemplate: props.initial.archiveNameTemplate || DEFAULT_ARCHIVE_NAME_TEMPLATE,
  showArchiveNameInput: props.initial.showArchiveNameInput ?? false,
  autoCountImageTokens: props.initial.autoCountImageTokens ?? false,
});

function saveSettings() {
  emit('success', {
    archiveNameTemplate: form.archiveNameTemplate.trim() || DEFAULT_ARCHIVE_NAME_TEMPLATE,
    showArchiveNameInput: form.showArchiveNameInput,
    autoCountImageTokens: form.autoCountImageTokens,
  });
}
</script>

<template>
  <form
    class="flex flex-col gap-3 w-[420px]"
    @submit.prevent="saveSettings"
  >
    <FormField
      id="export-task-archive-template"
      label="Шаблон названия архива"
      tip="{task_id} — номер задачи, {task_slug} — текст названия задачи, переведённый на английский (пробелы заменяются на _; префикс проекта и оценка через | отбрасываются). Расширение .zip добавляется автоматически, если его нет"
      tip-interactive
    >
      <InputText
        id="export-task-archive-template"
        v-model="form.archiveNameTemplate"
        :placeholder="DEFAULT_ARCHIVE_NAME_TEMPLATE"
        fluid
        size="small"
      />
    </FormField>

    <div class="flex gap-2 items-center">
      <ToggleSwitch
        v-model="form.showArchiveNameInput"
        input-id="export-task-show-archive-name"
        size="small"
      />
      <label
        for="export-task-show-archive-name"
        class="text-sm cursor-pointer"
      >Показывать поле «Название архива»</label>
    </div>

    <div class="flex gap-2 items-center">
      <ToggleSwitch
        v-model="form.autoCountImageTokens"
        input-id="export-task-auto-count-image-tokens"
        size="small"
      />
      <label
        for="export-task-auto-count-image-tokens"
        class="text-sm cursor-pointer"
      >Сразу считать токены за изображения</label>
      <i
        v-tooltip="'Без этого токены за изображения считаются по кнопке. Чтобы узнать размеры, изображения приходится скачивать — с этой настройкой это происходит при каждом открытии окна экспорта'"
        class="pi pi-question-circle text-surface-500 dark:text-surface-400"
      />
    </div>

    <Button
      size="small"
      type="submit"
      label="Сохранить"
      class="self-start"
    />
  </form>
</template>
