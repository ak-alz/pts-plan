<script setup>
import { Badge, Column, DataTable } from 'primevue';

defineProps({
  users: {
    type: Array,
    default() {
      return [];
    },
  },
});
</script>

<template>
  <DataTable
    :value="users"
    data-key="id"
    size="small"
    sort-field="median"
    :sort-order="-1"
    :default-sort-order="-1"
  >
    <Column
      field="name"
      header="Исполнитель"
    >
      <template #body="{data}">
        <a
          target="_top"
          :href="data.url"
        >
          <Badge :style="`background-color: ${data.color};`" />
          {{ data.name }}
        </a>
      </template>
    </Column>
    <Column>
      <template #header>
        <b>Спринтов</b>
        <i
          v-tooltip="'Для расчётов/Отфильтрованные/Все'"
          class="pi pi-question-circle"
        />
      </template>
      <template #body="{data}">
        {{ data.visibleSprints.length }}/{{ data.filteredSprintsLength }}/{{ data.sprints.length }}
      </template>
    </Column>
    <Column
      field="avg"
      header="Средний балл"
      sortable
    >
      <template #body="{data}">
        {{ data.avg }}
        <span
          v-if="data.deltaAvg"
          class="text-sm"
          :class="{
            'text-green-400': data.deltaAvg > 0,
            'text-red-400': data.deltaAvg < 0,
          }"
        >
          <template v-if="data.deltaAvg > 0">+</template>{{ data.deltaAvg }}
        </span>
      </template>
    </Column>
    <Column
      field="median"
      header="Медианный балл"
      sortable
    >
      <template #body="{data}">
        {{ data.median }}
        <span
          v-if="data.deltaMedian"
          class="text-sm"
          :class="{
            'text-green-400': data.deltaMedian > 0,
            'text-red-400': data.deltaMedian < 0,
            'text-surface-400': data.deltaMedian === 0,
          }"
        >
          <template v-if="data.deltaMedian > 0">+</template>{{ data.deltaMedian }}
        </span>
      </template>
    </Column>

    <template #empty>
      Нет данных
    </template>
  </DataTable>
</template>

<style scoped>

</style>
