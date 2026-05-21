<script setup>
import {Column, DataTable} from 'primevue';

defineProps({
  rows: {type: Array, required: true},
});
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
      field="totalPoints"
      header="Баллов всего"
      sortable
    />
  </DataTable>
</template>
