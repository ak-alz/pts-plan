<script setup>
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
  Avatar,
  Badge,
  Button, Checkbox,
  MultiSelect,
  Select,
} from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, reactive, ref, toRaw } from 'vue';

import FormField from '../../../ui/FormField.vue';
import { defaultSortColumn } from '../variables.js';

const props = defineProps({
  users: {
    type: Array,
    default() {
      return [];
    },
  },
  columns: {
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
  users: props.initial.users ? toRaw(props.initial.users) : [],
  columns: props.initial.columns ? toRaw(props.initial.columns) : [],
  showCompleteTasksButton: props.initial.showCompleteTasksButton ? toRaw(props.initial.showCompleteTasksButton) : [],
  sortColumn: props.initial.sortColumn ? toRaw(props.initial.sortColumn) : defaultSortColumn,
  excludeFromTotal: props.initial.excludeFromTotal ? toRaw(props.initial.excludeFromTotal) : [],
  ignoreCompleted: props.initial.ignoreCompleted || false,
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

const sortableColumns = computed(() => {
  return [
    ...props.columns.map((column) => ({
      id: `columns.${column.id}.totalPoints`,
      name: column.name,
      color: column.color,
    })),
    {
      id: defaultSortColumn,
      name: 'Итого',
    },
  ];
});
</script>

<template>
  <form
    class="flex flex-col gap-3"
    style="width: 600px;"
    @submit.prevent="saveSettings"
  >
    <div class="grid grid-cols-2 gap-x-2 gap-y-3">
      <FormField
        id="settings_users"
        label="Исполнители"
        tip="Если вы не нашли нужного исполнителя, значит его нет в первых 20 задач каждой колонки"
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
        >
          <template #option="{option}">
            <Avatar
              v-if="option.photo"
              :image="option.photo"
              shape="circle"
            />
            {{ option.name }}
          </template>
        </MultiSelect>
      </FormField>

      <FormField
        id="settings_columns"
        label="Колонки"
      >
        <MultiSelect
          v-model="form.columns"
          option-value="id"
          option-label="name"
          :options="columns"
          filter
          filter-placeholder="Поиск"
          fluid
          input-id="settings_columns"
          :max-selected-labels="3"
          placeholder="Выбрать"
        >
          <template #option="{option}">
            <Badge :style="`background-color: ${option.color};`" />
            {{ option.name }}
          </template>
        </MultiSelect>
      </FormField>
    </div>

    <Accordion
      :dt="{
        headerPadding: '10px 0',
        contentPadding: '10px 0',
      }"
    >
      <AccordionPanel value="additional">
        <AccordionHeader>
          Дополнительные настройки
        </AccordionHeader>
        <AccordionContent>
          <div class="grid grid-cols-2 gap-x-2 gap-y-3">
            <FormField
              id="settings_show_complete_tasks_button"
              label="Завершить все задачи"
              tip="Для выбранных колонок появится кнопка для завершения всех задач"
            >
              <MultiSelect
                v-model="form.showCompleteTasksButton"
                option-value="id"
                option-label="name"
                :options="columns"
                filter
                filter-placeholder="Поиск"
                fluid
                input-id="settings_show_complete_tasks_button"
                :max-selected-labels="3"
                placeholder="Выбрать"
              >
                <template #option="{option}">
                  <Badge :style="`background-color: ${option.color};`" />
                  {{ option.name }}
                </template>
              </MultiSelect>
            </FormField>

            <FormField
              id="settings_sort_column"
              label="Сортировка по умолчанию"
              tip="Для выбранной колонки будет применяться сортировка по количеству баллов от большего к меньшему"
            >
              <Select
                v-model="form.sortColumn"
                option-value="id"
                option-label="name"
                :options="sortableColumns"
                filter
                filter-placeholder="Поиск"
                fluid
                input-id="settings_sort_column"
                placeholder="Выбрать"
                :pt="{
                  label: {style: 'font-size: 14px;'}
                }"
              >
                <template #option="{option}">
                  <Badge
                    v-if="option.color"
                    :style="`background-color: ${option.color};`"
                    class="mr-2"
                  />
                  {{ option.name }}
                </template>
              </Select>
            </FormField>

            <FormField
              id="settings_exclude_from_total"
              label="Исключить из колонки «Итого»"
              tip="Выбранные колонки будут исключены из суммы баллов в колонке «Итого»"
            >
              <MultiSelect
                v-model="form.excludeFromTotal"
                option-value="id"
                option-label="name"
                :options="columns"
                filter
                filter-placeholder="Поиск"
                fluid
                input-id="settings_exclude_from_total"
                :max-selected-labels="3"
                placeholder="Выбрать"
              >
                <template #option="{option}">
                  <Badge :style="`background-color: ${option.color};`" />
                  {{ option.name }}
                </template>
              </MultiSelect>
            </FormField>

            <div class="flex gap-1 items-center">
              <Checkbox
                v-model="form.ignoreCompleted"
                binary
                input-id="settings_ignore_completed"
              />
              <label for="settings_ignore_completed">
                Исключить завершённые задачи
              </label>
              <i
                v-tooltip="'Завершённые задачи не будут отображаться в итоговой таблице. Полезно, если вы не читаете комментарии в закрытых задачах.'"
                class="pi pi-question-circle"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <Button
      size="small"
      type="submit"
      label="Сохранить"
      class="self-start"
      :loading="isLoading"
    />
  </form>
</template>

<style scoped>

</style>
