<script setup>
import {Column, DataTable} from 'primevue';

defineProps({
  rows: {type: Array, required: true},
  multiUser: {type: Boolean, default: false},
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
    <Column
      v-if="multiUser"
      header="Исполнители"
    >
      <template #body="{ data }">
        <div class="flex flex-col gap-1">
          <template
            v-for="name in data.userNames"
            :key="name"
          >
            {{ name }}
          </template>
        </div>
      </template>
    </Column>
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
