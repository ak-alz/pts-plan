<script setup>
import { Badge, Button, Checkbox, Select } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { reactive, ref, toRaw } from 'vue';

import FormField from '../../../ui/FormField.vue';

const props = defineProps({
  stages: {
    type: Array,
    default() {
      return [];
    },
  },
  initial: {
    type: Object,
    default() {
      return {};
    },
  },
  settingsStorageKey: {
    type: String,
    required: true,
  },
});

const emits = defineEmits(['success']);

const toast = useToast();
const isLoading = ref(false);

const form = reactive({
  defaultStageId: props.initial.defaultStageId ?? null,
  defaultResponsible: props.initial.defaultResponsible ?? 'inherit',
  defaultAuditors: props.initial.defaultAuditors ?? 'inherit',
  description: props.initial.description ?? false,
  copyContentDefault: props.initial.copyContentDefault ?? false,
  showCreatedTasks: props.initial.showCreatedTasks ?? false,
  showCommitCheckbox: props.initial.showCommitCheckbox ?? false,
  copyCommitDefault: props.initial.copyCommitDefault ?? false,
});

async function saveSettings() {
  isLoading.value = true;

  try {
    await chrome.storage.local.set({
      [props.settingsStorageKey]: toRaw(form),
    });

    toast.add({
      severity: 'success',
      summary: 'Сохранено',
      detail: 'Настройки успешно сохранены.',
      life: 5000,
    });

    emits('success');
  } catch (e) {
    console.warn(e);
  } finally {
    isLoading.value = false;
  }
}

const responsibleOptions = [
  {
    label: 'Наследовать',
    value: 'inherit',
  },
  {
    label: 'Вы',
    value: 'user',
  },
];

const auditorOptions = [
  {
    label: 'Наследовать',
    value: 'inherit',
  },
  {
    label: 'Все',
    value: 'all',
  },
];
</script>

<template>
  <form
    class="flex flex-col gap-3"
    style="width: 320px;"
    @submit.prevent="saveSettings"
  >
    <FormField
      id="dt_default_stage"
      label="Стадия по умолчанию"
    >
      <Select
        v-model="form.defaultStageId"
        option-value="id"
        option-label="title"
        :options="stages"
        show-clear
        fluid
        input-id="dt_default_stage"
        placeholder="Не выбрана"
      >
        <template #option="{ option }">
          <div class="flex gap-2 items-center">
            <Badge :style="`background-color: ${option.color};`" />
            {{ option.title }}
          </div>
        </template>
      </Select>
    </FormField>

    <FormField
      id="dt_default_responsible"
      label="Исполнитель по умолчанию"
    >
      <Select
        v-model="form.defaultResponsible"
        option-value="value"
        option-label="label"
        :options="responsibleOptions"
        fluid
        input-id="dt_default_responsible"
        placeholder="Не выбран"
      />
    </FormField>

    <FormField
      id="dt_default_auditors"
      label="Наблюдатели по умолчанию"
    >
      <Select
        v-model="form.defaultAuditors"
        option-value="value"
        option-label="label"
        :options="auditorOptions"
        show-clear
        fluid
        input-id="dt_default_auditors"
        placeholder="Вы"
      />
    </FormField>

    <div class="flex gap-1 items-center">
      <Checkbox
        v-model="form.description"
        binary
        input-id="dt_all_description_default"
      />
      <label for="dt_all_description_default">Выводить поле «Описание»</label>
    </div>

    <div class="flex gap-1 items-center">
      <Checkbox
        v-model="form.copyContentDefault"
        binary
        input-id="dt_copy_content_default"
      />
      <label for="dt_copy_content_default">Скопировать описание по умолчанию</label>
      <i
        v-tooltip.top="'Файловые вложения не копируются'"
        class="pi pi-question-circle"
      />
    </div>

    <div class="flex gap-1 items-center">
      <Checkbox
        v-model="form.showCreatedTasks"
        binary
        input-id="dt_show_created_tasks"
      />
      <label for="dt_show_created_tasks">Показывать список созданных задач</label>
    </div>

    <div class="flex gap-1 items-center">
      <Checkbox
        v-model="form.showCommitCheckbox"
        binary
        input-id="dt_show_commit_checkbox"
      />
      <label for="dt_show_commit_checkbox">Показывать «Копировать текст коммита»</label>
      <i
        v-tooltip.top="'Можно отметить только одну задачу — после создания текст коммита для неё попадёт в буфер обмена'"
        class="pi pi-question-circle"
      />
    </div>

    <div class="flex gap-1 items-center">
      <Checkbox
        v-model="form.copyCommitDefault"
        binary
        input-id="dt_copy_commit_default"
      />
      <label for="dt_copy_commit_default">«Копировать текст коммита» по умолчанию для первой задачи</label>
    </div>

    <Button
      size="small"
      type="submit"
      label="Сохранить"
      class="self-start"
      :loading="isLoading"
    />
  </form>
</template>
