<script setup>
import {Button, Column, DataTable, Dialog} from 'primevue';
import {ref} from 'vue';

import TaskList from './TaskList.vue';

defineProps({
  rows: {type: Array, required: true},
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
    data-key="key"
    sort-field="totalPoints"
    :sort-order="-1"
    :default-sort-order="-1"
    size="small"
  >
    <Column
      v-if="multiUser"
      header="Исполнители"
    >
      <template #body="{ data }">
        <div class="flex flex-col gap-1">
          <a
            v-for="user in data.users"
            :key="user.id"
            :href="user.url"
            target="_top"
          >
            {{ user.name }}
          </a>
        </div>
      </template>
    </Column>
    <Column header="Задача">
      <template #body="{ data }">
        <a
          class="pts-blur"
          :href="data.url"
          target="_top"
        >
          {{ data.title }}
        </a>
      </template>
    </Column>
    <Column
      field="totalPoints"
      header="Баллов всего"
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
  </DataTable>

  <Dialog
    v-model:visible="isTaskListOpened"
    :header="selectedRow?.title"
    dismissable-mask
    modal
  >
    <TaskList
      :tasks="selectedRow?.tasks ?? []"
      :multi-user="multiUser"
    />
  </Dialog>
</template>
