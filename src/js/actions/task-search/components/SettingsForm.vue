<script setup>
import { Button, InputText, MultiSelect, Select, ToggleSwitch } from 'primevue';
import { reactive, ref, toRaw } from 'vue';

import {showToast} from '../../../toastHost/showToast.js';
import FormField from '../../../ui/FormField.vue';

const props = defineProps({
  initial: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['success']);

const STATUS_OPTIONS = [
  { label: 'Все', value: null },
  { label: 'Не завершённые', value: 'active' },
  { label: 'Завершённые', value: 'closed' },
];

const PARENT_TYPE_OPTIONS = [
  { label: 'Все', value: 'all' },
  { label: 'Корневые', value: 'root' },
  { label: 'Подзадачи', value: 'subtask' },
];

const RESULT_LIMIT_OPTIONS = [
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '200', value: 200 },
  { label: '500', value: 500 },
  { label: 'Без ограничения', value: null },
];

const HIDDEN_FILTER_OPTIONS = [
  { label: 'Исключить из названия', value: 'excludeTitle' },
  { label: 'Статус', value: 'status' },
  { label: 'Тип задачи', value: 'parentType' },
  { label: 'Дата создания', value: 'createdDate' },
  { label: 'Дата изменения', value: 'changedDate' },
  { label: 'Искать в описании и комментариях', value: 'extendedSearch' },
  { label: 'Исключить хотфиксы', value: 'excludeHotfixes' },
];

const isLoading = ref(false);

const form = reactive({
  defaultStatus: props.initial.defaultStatus !== undefined ? props.initial.defaultStatus : 'active',
  defaultParentType: props.initial.defaultParentType ?? 'all',
  defaultUseGroupFilter: props.initial.defaultUseGroupFilter !== false,
  defaultSmartSearch: props.initial.defaultSmartSearch !== false,
  defaultExtendedSearch: props.initial.defaultExtendedSearch ?? false,
  defaultExcludeTitle: props.initial.defaultExcludeTitle ?? '',
  resultLimit: props.initial.resultLimit !== undefined ? props.initial.resultLimit : 100,
  hiddenFilters: props.initial.hiddenFilters ?? [],
});

async function saveSettings() {
  isLoading.value = true;
  try {
    await chrome.storage.local.set({ 'task-search-settings': toRaw(form) });
    showToast({ severity: 'success', summary: 'Сохранено', life: 3000 });
    emit('success', toRaw(form));
  } catch (e) {
    console.warn('[task-search] saveSettings failed:', e);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form
    class="flex flex-col gap-4 w-[580px]"
    @submit.prevent="saveSettings"
  >
    <div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-3">
        <FormField label="Статус">
          <Select
            v-model="form.defaultStatus"
            :options="STATUS_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
          />
        </FormField>
        <FormField label="Тип задачи">
          <Select
            v-model="form.defaultParentType"
            :options="PARENT_TYPE_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
          />
        </FormField>
        <div class="flex gap-2 items-center self-end">
          <ToggleSwitch
            v-model="form.defaultUseGroupFilter"
            input-id="settings-use-group-filter"
            size="small"
          />
          <label
            for="settings-use-group-filter"
            class="text-sm cursor-pointer"
          >Только текущая группа</label>
        </div>
        <div class="flex gap-2 items-center self-end">
          <ToggleSwitch
            v-model="form.defaultSmartSearch"
            input-id="settings-smart-search"
            size="small"
          />
          <label
            for="settings-smart-search"
            class="text-sm cursor-pointer"
          >Искать по каждому слову</label>
        </div>
        <div class="flex gap-2 items-center self-end">
          <ToggleSwitch
            v-model="form.defaultExtendedSearch"
            input-id="settings-extended-search"
            size="small"
          />
          <label
            for="settings-extended-search"
            class="text-sm cursor-pointer"
          >Искать в описании и комментариях</label>
        </div>
        <FormField
          label="Максимум задач"
          tip="Ограничивает количество задач в результатах поиска. Меньшее значение — быстрее загрузка."
        >
          <Select
            v-model="form.resultLimit"
            :options="RESULT_LIMIT_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
          />
        </FormField>
        <FormField
          label="Исключить по умолчанию"
          tip="Предзаполняет фильтр «Исключить из названия» при открытии поиска, например «hotfix»"
        >
          <InputText
            v-model="form.defaultExcludeTitle"
            size="small"
            placeholder="Например, hotfix"
            class="w-full"
          />
        </FormField>
        <FormField label="Скрыть фильтры">
          <MultiSelect
            v-model="form.hiddenFilters"
            :options="HIDDEN_FILTER_OPTIONS"
            option-label="label"
            option-value="value"
            placeholder="Ничего не скрыто"
            filter
            filter-placeholder="Поиск"
            show-clear
            size="small"
            class="w-full"
          />
        </FormField>
      </div>
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
