<script setup>
import dayjs from 'dayjs';
import {Button, Column, DataTable, Dialog} from 'primevue';
import {ref} from 'vue';

import TaskList from './TaskList.vue';

defineProps({
  rows: {type: Array, default: () => []},
  isLoading: {type: Boolean, default: false},
  multiUser: {type: Boolean, default: false},
});

const selectedRow = ref(null);
const isTaskListOpened = ref(false);

function openTaskList(row) {
  selectedRow.value = row;
  isTaskListOpened.value = true;
}
</script>

<template>
  <DataTable
    :value="rows"
    :loading="isLoading"
    data-key="key"
    sort-field="totalPoints"
    :sort-order="-1"
    :default-sort-order="-1"
    paginator
    :rows="20"
    :rows-per-page-options="[10, 20, 50]"
    size="small"
  >
    <Column
      v-if="multiUser"
      field="userName"
      header="Исполнитель"
      sortable
    />
    <Column header="Корневая задача">
      <template #body="{ data }">
        <a
          :href="data.url"
          target="_top"
        >
          {{ data.title }}
        </a>
      </template>
    </Column>
    <Column
      field="createdDate"
      header="Дата создания"
      sortable
    >
      <template #body="{ data }">
        {{ data.createdDate ? dayjs(data.createdDate).format('DD.MM.YYYY') : '—' }}<template v-if="data.maxDate && dayjs(data.maxDate).format('DD.MM.YYYY') !== dayjs(data.createdDate).format('DD.MM.YYYY')">
          — {{ dayjs(data.maxDate).format('DD.MM.YYYY') }}
        </template>
      </template>
    </Column>
    <Column
      field="totalPoints"
      header="Баллы"
      sortable
    >
      <template #body="{ data }">
        <Button
          size="small"
          variant="text"
          severity="secondary"
          @click="openTaskList(data)"
        >
          {{ data.totalPoints }} ({{ data.tasks.length }})
        </Button>
      </template>
    </Column>
    <template #empty>
      Нет данных за выбранный период
    </template>
  </DataTable>

  <Dialog
    v-model:visible="isTaskListOpened"
    :header="selectedRow?.title"
    dismissable-mask
    modal
  >
    <TaskList :tasks="selectedRow?.tasks ?? []" />
  </Dialog>
</template>
