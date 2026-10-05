<script setup>
import { Badge, Button, Column, ColumnGroup, DataTable, Dialog, Row } from 'primevue';
import { ref } from 'vue';

import TaskNameCell from './TaskNameCell.vue';

defineProps({
  groups: {
    type: Array,
    required: true,
  },
  totalPoints: {
    type: Number,
    default: 0,
  },
  // В окне «Итого» задачи группы лежат в разных колонках канбана — показываем колонку у каждой
  showColumn: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const selectedGroup = ref(null);
const isModalVisible = ref(false);

function openGroup(group) {
  selectedGroup.value = group;
  isModalVisible.value = true;
}
</script>

<template>
  <DataTable
    :value="groups"
    :loading="loading"
    data-key="key"
    sort-field="points"
    :sort-order="-1"
    size="small"
    striped-rows
  >
    <Column header="Родительская задача">
      <template #body="{data}">
        <TaskNameCell :task="{ name: data.name, url: data.url, isRootTask: true }" />
      </template>
    </Column>
    <Column
      field="points"
      header="Баллы"
      sortable
    >
      <template #body="{data}">
        <Button
          v-tooltip.top="data.hasSubtasks ? 'Показать задачи' : null"
          :label="`${data.points} (${data.tasks.length})`"
          :disabled="!data.hasSubtasks"
          size="small"
          severity="secondary"
          variant="text"
          @click="openGroup(data)"
        />
      </template>
    </Column>

    <ColumnGroup type="footer">
      <Row>
        <Column
          footer="Итого:"
          footer-class="text-right"
        />
        <Column :footer="totalPoints" />
      </Row>
    </ColumnGroup>

    <template #empty>
      Нет данных
    </template>
  </DataTable>

  <Dialog
    v-model:visible="isModalVisible"
    :header="`Задачи: ${selectedGroup?.name ?? ''}`"
    dismissable-mask
    modal
  >
    <DataTable
      v-if="selectedGroup"
      :value="selectedGroup.tasks"
      data-key="id"
      size="small"
      striped-rows
    >
      <Column
        v-if="showColumn"
        header="Колонка"
      >
        <template #body="{data}">
          <template v-if="data.column">
            <Badge :style="`background-color: ${data.column.color};`" />
            {{ data.column.name }}
          </template>
        </template>
      </Column>
      <Column header="Задача">
        <template #body="{data}">
          <TaskNameCell :task="data" />
        </template>
      </Column>
      <Column
        field="points"
        header="Баллы"
      />

      <template #empty>
        Нет данных
      </template>
    </DataTable>
  </Dialog>
</template>
