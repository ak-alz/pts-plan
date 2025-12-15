<script setup>
import { Column, ColumnGroup, DataTable, Row } from 'primevue';
import { computed } from 'vue';

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

const totalPoints = computed(() => {
  return props.user.columns[props.column.id].totalPoints;
});
</script>

<template>
  <DataTable
    :value="columnTasks"
    data-key="id"
    sort-field="points"
    :sort-order="-1"
    size="small"
  >
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
      sortable
    />

    <ColumnGroup type="footer">
      <Row>
        <Column
          footer="Итого:"
          footer-style="text-align: right;"
        />
        <Column :footer="totalPoints" />
      </Row>
    </ColumnGroup>

    <template #empty>
      Нет данных
    </template>
  </DataTable>
</template>

<style scoped>

</style>
