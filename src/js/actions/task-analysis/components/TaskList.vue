<script setup>
import dayjs from 'dayjs';
import { Column, ColumnGroup, DataTable, Row } from 'primevue';
import { computed } from 'vue';

const props = defineProps({
  tasks: {
    type: Array,
    default: () => [],
  },
  multiUser: {type: Boolean, default: false},
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
    <Column
      v-if="multiUser"
      field="responsible.name"
      header="Исполнитель"
    >
      <template #body="{ data }">
        <a
          :href="data.responsible.url"
          target="_top"
        >
          {{ data.responsible.name }}
        </a>
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
      field="closedDate"
      header="Дата закрытия"
      sortable
    >
      <template #body="{ data }">
        {{ data.closedDate ? dayjs(data.closedDate).format('DD.MM.YYYY') : '—' }}
      </template>
    </Column>
    <Column
      field="points"
      header="Баллы"
      sortable
    />

    <ColumnGroup type="footer">
      <Row>
        <Column v-if="multiUser" />
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
