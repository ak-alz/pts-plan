<script setup>
import { Avatar, Button, Checkbox, MultiSelect, Select } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { reactive, ref, toRaw } from 'vue';

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

const emits = defineEmits(['success']);
const toast = useToast();
const isLoading = ref(false);

const monthOptions = [
  { label: '1 месяц', value: 1 },
  { label: '2 месяца', value: 2 },
  { label: '3 месяца', value: 3 },
  { label: '6 месяцев', value: 6 },
  { label: '12 месяцев', value: 12 },
];

const statusOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Открытые', value: 'active' },
  { label: 'Закрытые', value: 'closed' },
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
  defaultStatus: props.initial.defaultStatus ?? 'closed',
  visibleUserIds: props.initial.visibleUserIds ? toRaw(props.initial.visibleUserIds) : [],
  copySeparator: props.initial.copySeparator ?? '\t',
  csvSeparator: props.initial.csvSeparator ?? ',',
  defaultTab: props.initial.defaultTab ?? 'summary',
  defaultCompareWithPrev: props.initial.defaultCompareWithPrev ?? false,
  defaultExcludeHotfixes: props.initial.defaultExcludeHotfixes ?? false,
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
    emits('success', toRaw(form));
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

      <FormField label="Статус задач">
        <Select
          v-model="form.defaultStatus"
          :options="statusOptions"
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
          placeholder="Из настроек расширения"
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
          v-model="form.defaultCompareWithPrev"
          binary
          input-id="settings-default-compare-with-prev"
        />
        <label
          for="settings-default-compare-with-prev"
          class="text-sm cursor-pointer"
        >Сравнивать с пред. периодом</label>
      </div>

      <div class="flex gap-2 items-center">
        <Checkbox
          v-model="form.defaultExcludeHotfixes"
          binary
          input-id="settings-default-exclude-hotfixes"
        />
        <label
          for="settings-default-exclude-hotfixes"
          class="text-sm cursor-pointer"
        >Исключить хотфиксы</label>
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
