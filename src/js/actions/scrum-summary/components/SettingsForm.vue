<script setup>
import { Button, InputNumber, MultiSelect, Select } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { reactive, ref, toRaw } from 'vue';

import FormField from '../../../ui/FormField.vue';
import { defaultIgnorePoints } from '../variables.js';

const props = defineProps({
  users: {
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
  simple: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['success']);

const monthOptions = [
  { label: '1 месяц', value: 1 },
  { label: '2 месяца', value: 2 },
  { label: '3 месяца', value: 3 },
  { label: '6 месяцев', value: 6 },
  { label: '12 месяцев', value: 12 },
];

const toast = useToast();

const isLoading = ref(false);

const form = reactive({
  users: props.initial.users ? toRaw(props.initial.users) : [],
  taskId: props.initial.taskId ? toRaw(props.initial.taskId) : null,
  defaultMonths: props.initial.defaultMonths ?? 6,
  ignorePoints: props.initial.ignorePoints != null ? toRaw(props.initial.ignorePoints) : defaultIgnorePoints,
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

    emit('success');
  } catch (e) {
    console.warn(e);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form
    class="flex flex-col gap-3 w-[400px]"
    @submit.prevent="saveSettings"
  >
    <FormField
      id="settings_task_id"
      label="ID задачи"
      tip="ID задачи, в комментариях которой есть информация об итогах прошедших спринтов. Структура таких комментариев должна соответсовать определенному формату."
    >
      <InputNumber
        v-model="form.taskId"
        :max-fraction-digits="0"
        :use-grouping="false"
        fluid
        input-id="settings_task_id"
      />
    </FormField>

    <template v-if="!simple">
      <FormField
        id="settings_users"
        label="Исполнители"
      >
        <MultiSelect
          v-model="form.users"
          option-value="id"
          option-label="name"
          :options="users"
          filter
          filter-placeholder="Поиск"
          fluid
          input-id="settings_users"
          :max-selected-labels="3"
          placeholder="Выбрать"
        />
      </FormField>

      <FormField
        id="settings_default_months"
        label="Период по умолчанию"
        tip="Начальный диапазон дат при открытии виджета"
      >
        <Select
          v-model="form.defaultMonths"
          :options="monthOptions"
          option-label="label"
          option-value="value"
          fluid
          size="small"
          input-id="settings_default_months"
        />
      </FormField>

      <FormField
        id="settings_ignore_points"
        label="Граница игнорирования баллов"
        tip="Игнорировать баллы исполнителей, если они ниже заданного числа (отпуск, короткая неделя)"
      >
        <InputNumber
          v-model="form.ignorePoints"
          :max-fraction-digits="0"
          :use-grouping="false"
          fluid
          :min="0"
          input-id="settings_ignore_points"
        />
      </FormField>
    </template>

    <Button
      size="small"
      type="submit"
      label="Сохранить"
      fluid
      :loading="isLoading"
    />
  </form>
</template>

