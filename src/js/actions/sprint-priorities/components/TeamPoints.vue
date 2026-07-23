<script setup>
import { Avatar, Badge, Button, Column, DataTable } from 'primevue';

defineProps({
  rows: {
    type: Array,
    default() {
      return [];
    },
  },
  selectedStages: {
    type: Array,
    default() {
      return [];
    },
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['cell-click']);
</script>

<template>
  <DataTable
    :value="rows"
    :loading="loading"
    data-key="id"
    size="small"
    striped-rows
    sort-field="totalPoints"
    :sort-order="-1"
    removable-sort
  >
    <Column
      field="name"
      header="Исполнитель"
      sortable
    >
      <template #body="{ data }">
        <div class="flex items-center gap-2">
          <Avatar
            v-if="data.photo"
            :image="data.photo"
            shape="circle"
          />
          <a
            :href="data.url"
            target="_top"
          >{{ data.name }}</a>
        </div>
      </template>
    </Column>

    <Column
      v-for="stage in selectedStages"
      :key="stage.id"
      :field="`stages.${stage.id}.points`"
      sortable
    >
      <template #header>
        <div class="flex items-center gap-1">
          <Badge
            v-if="stage.color"
            :style="`background-color: ${stage.color};`"
          />
          <b v-tooltip.top="stage.name">{{ stage.shortName }}</b>
        </div>
      </template>
      <template #body="{ data }">
        <Button
          size="small"
          variant="text"
          severity="secondary"
          :disabled="!data.stages[stage.id]?.taskCount"
          @click="$emit('cell-click', { user: data, stage })"
        >
          <template v-if="data.stages[stage.id]?.taskCount">
            {{ data.stages[stage.id].points }}
            ({{ data.stages[stage.id].taskCount }})
          </template>
          <template v-else>
            –
          </template>
        </Button>
      </template>
    </Column>

    <Column
      field="totalPoints"
      sortable
    >
      <template #header>
        <b>Итого</b>
      </template>
      <template #body="{ data }">
        <Button
          size="small"
          variant="text"
          severity="secondary"
          :disabled="!data.totalTaskCount"
          @click="$emit('cell-click', { user: data, stage: null })"
        >
          <template v-if="data.totalTaskCount">
            {{ data.totalPoints }}
            ({{ data.totalTaskCount }})
          </template>
          <template v-else>
            –
          </template>
        </Button>
      </template>
    </Column>

    <template #empty>
      Нет данных
    </template>
  </DataTable>
</template>
