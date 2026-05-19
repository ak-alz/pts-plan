<script setup>
import dayjs from 'dayjs';
import { Column, ColumnGroup, DataTable, Row } from 'primevue';
import { computed } from 'vue';

const props = defineProps({
  tasks: {
    type: Array,
    default: () => [],
  },
});

const totalPoints = computed(() => props.tasks.reduce((s, t) => s + t.points, 0));
</script>

<template>
  <DataTable
    :value="tasks"
    data-key="id"
    sort-field="points"
    :sort-order="-1"
    :default-sort-order="-1"
    size="small"
  >
    <Column header="Задача">
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
        {{ data.createdDate ? dayjs(data.createdDate).format('DD.MM.YYYY') : '—' }}
      </template>
    </Column>
    <Column
      field="points"
      header="Баллы"
      sortable
    />

    <ColumnGroup type="footer">
      <Row>
        <Column />
        <Column
          footer="Итого:"
          footer-class="text-right"
        />
        <Column :footer="totalPoints" />
      </Row>
    </ColumnGroup>
  </DataTable>
</template>
