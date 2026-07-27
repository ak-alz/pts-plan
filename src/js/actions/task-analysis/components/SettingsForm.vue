<script setup>
import { Avatar, Button, Checkbox, MultiSelect, Select } from 'primevue';
import { reactive, ref, toRaw } from 'vue';

import {showToast} from '../../../toastHost/showToast.js';
import FormField from '../../../ui/FormField.vue';

const props = defineProps({
  users: {
    type: Array,
    default: () => [],
  },
  initial: {
    type: Object,
    default: () => ({}),
  },
  settingsStorageKey: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['success']);
const isLoading = ref(false);

const monthOptions = [
  { label: '1 месяц', value: 1 },
  { label: '2 месяца', value: 2 },
  { label: '3 месяца', value: 3 },
  { label: '6 месяцев', value: 6 },
  { label: '12 месяцев', value: 12 },
];


const separatorOptions = [
  { label: 'Tab', value: '\t' },
  { label: 'Точка с запятой (;)', value: ';' },
  { label: 'Запятая (,)', value: ',' },
];

const tabOptions = [
  { label: 'Сводка', value: 'summary' },
  { label: 'Динамика', value: 'timeline' },
  { label: 'Топ задач', value: 'top' },
  { label: 'Размеры задач', value: 'histogram' },
];

const form = reactive({
  defaultMonths: props.initial.defaultMonths ?? 1,
  defaultUserIds: props.initial.defaultUserIds
    ? toRaw(props.initial.defaultUserIds)
    : (props.initial.defaultUserId ? [props.initial.defaultUserId] : []),
  visibleUserIds: props.initial.visibleUserIds ? toRaw(props.initial.visibleUserIds) : [],
  copySeparator: props.initial.copySeparator ?? '\t',
  csvSeparator: props.initial.csvSeparator ?? ',',
  defaultTab: props.initial.defaultTab ?? 'summary',
  defaultIncludeHotfixes: props.initial.defaultIncludeHotfixes ?? true,
  defaultCompareEnabled: props.initial.defaultCompareEnabled ?? true,
});

async function saveSettings() {
  isLoading.value = true;
  try {
    await chrome.storage.local.set({
      [props.settingsStorageKey]: toRaw(form),
    });
    showToast({
      severity: 'success',
      summary: 'Сохранено',
      detail: 'Настройки успешно сохранены.',
      life: 5000,
    });
    emit('success', toRaw(form));
  } catch (e) {
    console.warn(e);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form
    class="flex flex-col gap-3 w-[560px]"
    @submit.prevent="saveSettings"
  >
    <div class="grid grid-cols-2 gap-x-2 gap-y-3">
      <FormField label="Период по умолчанию">
        <Select
          v-model="form.defaultMonths"
          :options="monthOptions"
          option-label="label"
          option-value="value"
          fluid
          size="small"
        />
      </FormField>

      <FormField
        label="Исполнители по умолчанию"
        tip="Если никто не выбран — берётся ID пользователя из настроек расширения"
      >
        <MultiSelect
          v-model="form.defaultUserIds"
          :options="users"
          option-label="name"
          option-value="id"
          placeholder="Вы"
          :max-selected-labels="3"
          filter
          filter-placeholder="Поиск"
          fluid
          size="small"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.photo"
                :image="option.photo"
                shape="circle"
                size="small"
              />
              {{ option.name }}
            </div>
          </template>
        </MultiSelect>
      </FormField>

      <FormField
        label="Исполнители в фильтре"
        tip="Если никто не выбран — показываются все участники группы"
      >
        <MultiSelect
          v-model="form.visibleUserIds"
          :options="users"
          option-label="name"
          option-value="id"
          placeholder="Все участники группы"
          :max-selected-labels="3"
          filter
          filter-placeholder="Поиск"
          fluid
          size="small"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.photo"
                :image="option.photo"
                shape="circle"
                size="small"
              />
              {{ option.name }}
            </div>
          </template>
        </MultiSelect>
      </FormField>

      <FormField label="Вкладка по умолчанию">
        <Select
          v-model="form.defaultTab"
          :options="tabOptions"
          option-label="label"
          option-value="value"
          fluid
          size="small"
        />
      </FormField>

      <div class="flex gap-2 items-center">
        <Checkbox
          v-model="form.defaultIncludeHotfixes"
          binary
          input-id="settings-default-include-hotfixes"
        />
        <label
          for="settings-default-include-hotfixes"
          class="text-sm cursor-pointer"
        >Учитывать хотфиксы в данных</label>
      </div>

      <div class="flex gap-2 items-center">
        <Checkbox
          v-model="form.defaultCompareEnabled"
          binary
          input-id="settings-default-compare-enabled"
        />
        <label
          for="settings-default-compare-enabled"
          class="text-sm cursor-pointer"
        >
          Сравнивать с предыдущим периодом
          <i
            v-tooltip="'Состояние галки у поля «Сравнить с» при открытии виджета. Выключенное сравнение вдвое сокращает объём загрузки.'"
            class="pi pi-question-circle text-surface-400 dark:text-surface-500"
          />
        </label>
      </div>

      <FormField label="Разделитель копирования (сводка)">
        <Select
          v-model="form.copySeparator"
          :options="separatorOptions"
          option-label="label"
          option-value="value"
          fluid
          size="small"
        />
      </FormField>

      <FormField label="Разделитель CSV (сводка)">
        <Select
          v-model="form.csvSeparator"
          :options="separatorOptions"
          option-label="label"
          option-value="value"
          fluid
          size="small"
        />
      </FormField>
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
