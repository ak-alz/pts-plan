<script setup>
import { orderBy } from 'lodash-es';
import { Badge, Column, ColumnGroup, DataTable, Row } from 'primevue';
import { computed } from 'vue';

const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
  columns: {
    type: Array,
    default() {
      return [];
    },
  },
  excludedColumns: {
    type: Array,
    default() {
      return [];
    },
  },
  formattedExcludedColumns: {
    type: String,
    default: '',
  },
});

const columnsMap = computed(() => new Map(props.columns.map((column) => [column.id, column])));

const userTasks = computed(() => {
  let tasks = [];

  props.columns
    .filter((column) => !props.excludedColumns.includes(column.id))
    .forEach(({ id }) => {
      const columnTasks = props.user.columns[id].tasks.map((task) => ({
        ...task,
        column: columnsMap.value.get(id),
      }));

      tasks = tasks.concat(orderBy(columnTasks, 'points', 'desc'));
    });

  return tasks;
});
</script>

<template>
  <DataTable
    :value="userTasks"
    data-key="id"
    size="small"
    row-group-mode="rowspan"
    group-rows-by="column.id"
  >
    <Column field="column.id">
      <template #header>
        <b>Колонка</b>
        <i
          v-if="formattedExcludedColumns"
          v-tooltip.top="formattedExcludedColumns"
          class="pi pi-exclamation-circle"
        />
      </template>
      <template #body="{data}">
        <Badge :style="`background-color: ${data.column.color};`" />
        {{ data.column.name }}
      </template>
    </Column>

    <Column
      field="name"
      header="Задача"
    >
      <template #body="{data}">
        <a
          target="_top"
          :href="data.url"
          v-html="data.name"
        />
      </template>
    </Column>

    <Column
      field="points"
      header="Баллы"
    />

    <ColumnGroup type="footer">
      <Row>
        <Column
          colspan="2"
          footer="Итого:"
          footer-style="text-align: right;"
        />
        <Column :footer="user.visibleTotalPoints" />
      </Row>
    </ColumnGroup>

    <template #empty>
      Нет данных
    </template>
  </DataTable>
</template>

<style scoped>

</style>
