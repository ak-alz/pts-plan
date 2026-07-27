<script setup>
import { Button, InputText } from 'primevue';
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
});

function saveSettings() {
  emit('success', { archiveNameTemplate: form.archiveNameTemplate.trim() || DEFAULT_ARCHIVE_NAME_TEMPLATE });
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
    >
      <InputText
        id="export-task-archive-template"
        v-model="form.archiveNameTemplate"
        :placeholder="DEFAULT_ARCHIVE_NAME_TEMPLATE"
        fluid
        size="small"
      />
    </FormField>

    <Button
      size="small"
      type="submit"
      label="Сохранить"
      class="self-start"
    />
  </form>
</template>
