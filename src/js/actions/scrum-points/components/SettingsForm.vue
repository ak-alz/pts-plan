<script setup>
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
  Avatar,
  Badge,
  Button,
  InputNumber,
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
  groupUsers: {
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

const emit = defineEmits(['success']);

const toast = useToast();

const isLoading = ref(false);

const form = reactive({
  users: props.initial.users ? toRaw(props.initial.users) : [],
  columns: props.initial.columns ? toRaw(props.initial.columns) : [],
  showCompleteTasksButton: props.initial.showCompleteTasksButton ? toRaw(props.initial.showCompleteTasksButton) : [],
  sortColumn: props.initial.sortColumn ? toRaw(props.initial.sortColumn) : defaultSortColumn,
  excludeFromTotal: props.initial.excludeFromTotal ? toRaw(props.initial.excludeFromTotal) : [],
  showCopyButton: props.initial.showCopyButton ? toRaw(props.initial.showCopyButton) : [],
  showPostButton: props.initial.showPostButton ? toRaw(props.initial.showPostButton) : [],
  summaryTaskId: props.initial.summaryTaskId ?? null,
});

async function saveSettings() {
  isLoading.value = true;

  try {
    await chrome.storage.local.set({
      [props.settingsStorageKey]: toRaw(form),
    });

    toast.add({
      group: 'scrum-points',
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
    class="flex flex-col gap-3 w-[600px]"
    @submit.prevent="saveSettings"
  >
    <div class="grid grid-cols-2 gap-x-2 gap-y-3">
      <FormField
        id="settings_users"
        label="Исполнители"
      >
        <MultiSelect
          v-model="form.users"
          option-value="id"
          option-label="name"
          :options="groupUsers.length ? groupUsers : users"
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

            <FormField
              id="settings_show_copy_button"
              label="Копировать итоги"
              tip="Функционал для тех, кто подводит итоги спринта. Для выбранных колонок появится кнопка для копирования итогов спринта в формате BBCode."
            >
              <MultiSelect
                v-model="form.showCopyButton"
                option-value="id"
                option-label="name"
                :options="columns"
                filter
                filter-placeholder="Поиск"
                fluid
                input-id="settings_show_copy_button"
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
              id="settings_show_post_button"
              label="Опубликовать итоги"
              tip="Для выбранных колонок появится кнопка, которая автоматически создаёт комментарий с итогами спринта в указанной задаче."
            >
              <MultiSelect
                v-model="form.showPostButton"
                option-value="id"
                option-label="name"
                :options="columns"
                filter
                filter-placeholder="Поиск"
                fluid
                input-id="settings_show_post_button"
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
              id="settings_summary_task_id"
              label="ID задачи для итогов"
              tip="ID задачи, в которую будет публиковаться комментарий с итогами спринта."
            >
              <InputNumber
                v-model="form.summaryTaskId"
                :max-fraction-digits="0"
                :use-grouping="false"
                fluid
                input-id="settings_summary_task_id"
                placeholder="Не указан"
              />
            </FormField>
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

