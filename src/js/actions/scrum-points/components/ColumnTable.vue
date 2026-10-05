<script setup>
import { Column, ColumnGroup, DataTable, Row } from 'primevue';
import { computed, inject } from 'vue';

import { groupTasksByRoot } from '../variables.js';
import GroupByParentToggle from './GroupByParentToggle.vue';
import RootGroupsTable from './RootGroupsTable.vue';
import TaskNameCell from './TaskNameCell.vue';

const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
  column: {
    type: Object,
    required: true,
  },
});

const columnTasks = computed(() => {
  return props.user.columns[props.column.id].tasks;
});

const { groupByParent, loadingAncestors, rootByTaskId } = inject('taskGrouping');

const groups = computed(() => (groupByParent.value ? groupTasksByRoot(columnTasks.value, rootByTaskId.value) : []));

const totalPoints = computed(() => {
  return props.user.columns[props.column.id].totalPoints;
});
</script>

<template>
  <GroupByParentToggle />

  <RootGroupsTable
    v-if="groupByParent"
    :groups
    :total-points="totalPoints"
    :loading="loadingAncestors"
  />
  <DataTable
    v-else
    :value="columnTasks"
    data-key="id"
    sort-field="points"
    :sort-order="-1"
    size="small"
    striped-rows
  >
    <Column
      field="name"
      header="Задача"
    >
      <template #body="{data}">
        <TaskNameCell :task="data" />
      </template>
    </Column>
    <Column
      field="points"
      header="Баллы"
      sortable
    />

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
</template>

