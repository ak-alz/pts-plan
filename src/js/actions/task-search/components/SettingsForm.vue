<script setup>
import { Button, Checkbox, Select, ToggleSwitch } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { reactive, ref, toRaw } from 'vue';

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

const toast = useToast();
const isLoading = ref(false);

const form = reactive({
  defaultStatus: props.initial.defaultStatus !== undefined ? props.initial.defaultStatus : 'active',
  defaultParentType: props.initial.defaultParentType ?? 'all',
  defaultUseGroupFilter: props.initial.defaultUseGroupFilter !== false,
  defaultSmartSearch: props.initial.defaultSmartSearch !== false,
  defaultExtendedSearch: props.initial.defaultExtendedSearch ?? false,
  resultLimit: props.initial.resultLimit !== undefined ? props.initial.resultLimit : 100,
  hideExcludeTitle: props.initial.hideExcludeTitle ?? false,
  hideStatus: props.initial.hideStatus ?? false,
  hideParentType: props.initial.hideParentType ?? false,
  hideCreatedDate: props.initial.hideCreatedDate ?? false,
  hideChangedDate: props.initial.hideChangedDate ?? false,
  hideExtendedSearch: props.initial.hideExtendedSearch ?? false,
});

async function saveSettings() {
  isLoading.value = true;
  try {
    await chrome.storage.local.set({ 'task-search-settings': toRaw(form) });
    toast.add({ severity: 'success', summary: 'Сохранено', life: 3000 });
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
    class="flex flex-col gap-4 w-[480px]"
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
        <div class="flex gap-2 items-center">
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
        <div class="flex gap-2 items-center">
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
        <div class="flex gap-2 items-center">
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
      </div>
    </div>

    <div>
      <p class="text-sm font-semibold mb-2">
        Скрыть фильтры
      </p>
      <div class="flex flex-col gap-2">
        <div class="flex gap-2 items-center">
          <Checkbox
            v-model="form.hideExcludeTitle"
            binary
            input-id="settings-hide-exclude-title"
          />
          <label
            for="settings-hide-exclude-title"
            class="text-sm cursor-pointer"
          >Исключить из названия</label>
        </div>
        <div class="flex gap-2 items-center">
          <Checkbox
            v-model="form.hideStatus"
            binary
            input-id="settings-hide-status"
          />
          <label
            for="settings-hide-status"
            class="text-sm cursor-pointer"
          >Статус</label>
        </div>
        <div class="flex gap-2 items-center">
          <Checkbox
            v-model="form.hideParentType"
            binary
            input-id="settings-hide-parent-type"
          />
          <label
            for="settings-hide-parent-type"
            class="text-sm cursor-pointer"
          >Тип задачи</label>
        </div>
        <div class="flex gap-2 items-center">
          <Checkbox
            v-model="form.hideCreatedDate"
            binary
            input-id="settings-hide-created-date"
          />
          <label
            for="settings-hide-created-date"
            class="text-sm cursor-pointer"
          >Дата создания</label>
        </div>
        <div class="flex gap-2 items-center">
          <Checkbox
            v-model="form.hideChangedDate"
            binary
            input-id="settings-hide-changed-date"
          />
          <label
            for="settings-hide-changed-date"
            class="text-sm cursor-pointer"
          >Дата изменения</label>
        </div>
        <div class="flex gap-2 items-center">
          <Checkbox
            v-model="form.hideExtendedSearch"
            binary
            input-id="settings-hide-extended-search"
          />
          <label
            for="settings-hide-extended-search"
            class="text-sm cursor-pointer"
          >Искать в описании и комментариях</label>
        </div>
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
