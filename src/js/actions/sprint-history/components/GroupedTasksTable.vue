<script setup>
import dayjs from 'dayjs';
import { Badge, Button, Column, ColumnGroup, DataTable, Dialog, Row } from 'primevue';
import { computed, ref } from 'vue';

import { getTaskUrl } from '../../../utils.js';
import TaskTable from './TaskTable.vue';

const props = defineProps({
  rows: {
    type: Array,
    default() {
      return [];
    },
  },
  groupId: {
    type: String,
    required: true,
  },
  stages: {
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

const stagesMap = computed(() => new Map(props.stages.map((s) => [s.id, s])));

const totalPoints = computed(() => props.rows.reduce((sum, r) => sum + r.totalPoints, 0));

const selectedRow = ref(null);
const isModalVisible = ref(false);

function openModal(row) {
  selectedRow.value = row;
  isModalVisible.value = true;
}

const modalTasks = computed(() => {
  if (!selectedRow.value) return [];
  const result = selectedRow.value.parentTask ? [selectedRow.value.parentTask] : [];
  return result.concat(selectedRow.value.subtasks);
});
</script>

<template>
  <DataTable
    :value="rows"
    :loading="loading"
    data-key="parentId"
    sort-field="totalPoints"
    :sort-order="-1"
    :default-sort-order="-1"
    size="small"
  >
    <Column header="Исполнители">
      <template #body="{ data }">
        <div class="flex flex-col gap-1">
          <a
            v-for="r in data.responsibles"
            :key="r.id"
            :href="r.link"
            target="_top"
          >
            {{ r.name }}
          </a>
        </div>
      </template>
    </Column>

    <Column header="Задача">
      <template #body="{ data }">
        <a
          :href="getTaskUrl(groupId, data.parentId)"
          target="_top"
        >
          {{ data.parentTitle }}
        </a>
      </template>
    </Column>

    <Column
      field="totalPoints"
      header="Баллы"
      sortable
    >
      <template #body="{ data }">
        <Button
          :disabled="!data.hasSubtasks"
          size="small"
          variant="text"
          severity="secondary"
          @click="openModal(data)"
        >
          <template v-if="!!data.totalTasks">
            {{ data.totalPoints || '–' }}
            ({{ data.totalTasks }})
          </template>
          <template v-else>
            –
          </template>
        </Button>
      </template>
    </Column>

    <Column
      field="parentClosedDate"
      header="Закрыта"
      sortable
    >
      <template #body="{ data }">
        <template v-if="data.parentClosedDate">
          {{ dayjs(data.parentClosedDate).format('DD.MM.YYYY') }}
        </template>
        <template v-else-if="data.parentStageId && stagesMap.has(data.parentStageId)">
          <div class="flex gap-2 items-center">
            <Badge :style="`background-color: ${stagesMap.get(data.parentStageId).color};`" />
            {{ stagesMap.get(data.parentStageId).name }}
          </div>
        </template>
        <template v-else>
          —
        </template>
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

  <Dialog
    v-model:visible="isModalVisible"
    :header="`Подзадачи: ${selectedRow?.parentTitle}`"
    dismissable-mask
    modal
  >
    <TaskTable
      v-if="selectedRow"
      :tasks="modalTasks"
      :group-id="groupId"
      :highlight-ids="selectedRow.parentTask ? [selectedRow.parentId] : []"
    />
  </Dialog>
</template>
