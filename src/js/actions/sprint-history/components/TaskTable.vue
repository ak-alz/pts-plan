<script setup>
import dayjs from 'dayjs';
import { Column, ColumnGroup, DataTable, Row } from 'primevue';
import { computed } from 'vue';

import { getTaskUrl } from '../../../utils.js';

const props = defineProps({
  tasks: {
    type: Array,
    default() {
      return [];
    },
  },
  groupId: {
    type: String,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  highlightIds: {
    type: Array,
    default() {
      return [];
    },
  },
});

const totalPoints = computed(() => props.tasks.reduce((sum, t) => sum + t.points, 0));

function isRootTask(task) {
  return String(task.parentId ?? 0) === '0';
}
</script>

<template>
  <DataTable
    :value="tasks"
    :loading="loading"
    data-key="id"
    sort-field="points"
    :sort-order="-1"
    :default-sort-order="-1"
    size="small"
    striped-rows
    :paginator="tasks.length > 25"
    :rows="25"
    :rows-per-page-options="[10, 25, 50, 100]"
  >
    <Column
      field="responsible.name"
      header="Исполнитель"
      sortable
    >
      <template #body="{ data }">
        <a
          :href="data.responsible.link"
          target="_top"
        >
          {{ data.responsible.name }}
        </a>
      </template>
    </Column>
    <Column header="Задача">
      <template #body="{ data }">
        <i
          v-if="isRootTask(data)"
          v-tooltip.top="'Корневая задача'"
          class="pi pi-sitemap text-surface-400 mr-1"
        />
        <a
          :href="getTaskUrl(groupId, data.id)"
          target="_top"
          class="pts-blur"
          :class="{ 'font-bold': highlightIds.includes(String(data.id)) }"
        >
          {{ data.title }}
        </a>
      </template>
    </Column>
    <Column
      field="points"
      header="Баллы"
      sortable
    />
    <Column
      field="closedDate"
      header="Закрыта"
      sortable
    >
      <template #body="{ data }">
        {{ dayjs(data.closedDate).format('DD.MM.YYYY') }}
      </template>
    </Column>

    <ColumnGroup type="footer">
      <Row>
        <Column
          colspan="2"
          footer="Итого:"
          footer-class="text-right"
        />
        <Column :footer="totalPoints" />
        <Column />
      </Row>
    </ColumnGroup>

    <template #empty>
      Нет завершённых задач за выбранный период
    </template>
  </DataTable>
</template>
