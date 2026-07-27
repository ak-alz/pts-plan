<script setup>
import dayjs from 'dayjs';
import {Button, Column, DataTable, Message, Skeleton} from 'primevue';
import {computed} from 'vue';

import {barDataset} from '../chartDatasets.js';
import {AGE_BUCKET_COLORS, AGE_BUCKETS, STALE_DAYS} from '../variables.js';
import DynamicsChart from './DynamicsChart.vue';
import ExportButtons from './ExportButtons.vue';

const props = defineProps({
  snapshot: {
    type: Object,
    default: null,
  },
  snapshotAt: {
    type: String,
    default: null,
  },
  snapshotLoading: {
    type: Boolean,
    default: false,
  },
  hasBacklogColumns: {
    type: Boolean,
    default: false,
  },
  valueMode: {
    type: String,
    default: 'absolute',
  },
  copySeparator: {
    type: String,
    default: '\t',
  },
  csvSeparator: {
    type: String,
    default: ',',
  },
});

const emit = defineEmits(['open-settings']);

const backlogStages = computed(() => props.snapshot?.backlog?.byStage ?? []);
const excludedStages = computed(() => props.snapshot?.excluded?.byStage ?? []);

const chartData = computed(() => ({
  labels: backlogStages.value.map((stage) => stage.name),
  datasets: AGE_BUCKETS.map((bucket, index) => barDataset({
    label: bucket.label,
    data: backlogStages.value.map((stage) => {
      const count = stage.ageBuckets[bucket.key];
      if (props.valueMode !== 'share') return count;
      return stage.total ? Math.round((count / stage.total) * 1000) / 10 : 0;
    }),
    color: AGE_BUCKET_COLORS[index],
    valueSuffix: props.valueMode === 'share' ? '%' : '',
    stack: 'age',
  })),
}));

const exportHeaders = computed(() => [
  'Колонка',
  'Задач',
  ...AGE_BUCKETS.map((bucket) => bucket.label),
  `Без движения дольше ${STALE_DAYS} дней`,
  'Медианный возраст, дней',
  '85-й перцентиль возраста, дней',
]);

const exportRows = computed(() => backlogStages.value.map((stage) => [
  stage.name,
  stage.total,
  ...AGE_BUCKETS.map((bucket) => stage.ageBuckets[bucket.key]),
  stage.staleCount,
  stage.medianAge ?? '',
  stage.p85Age ?? '',
]));

const snapshotLabel = computed(() => (props.snapshotAt ? dayjs(props.snapshotAt).format('DD.MM.YYYY HH:mm') : null));
</script>

<template>
  <Message
    v-if="!hasBacklogColumns"
    severity="warn"
    :closable="false"
    class="mb-3"
  >
    <div class="flex items-center gap-3 flex-wrap">
      <span>Колонки с планами не выбраны. Без разметки нельзя отличить реальную очередь от архивной колонки, поэтому виджет не знает, что считать планами.</span>
      <Button
        size="small"
        severity="secondary"
        icon="pi pi-cog"
        label="Выбрать колонки"
        @click="emit('open-settings')"
      />
    </div>
  </Message>

  <div
    v-else-if="snapshotLoading && !snapshot"
    class="flex flex-col gap-2"
  >
    <Skeleton height="24px" />
    <Skeleton height="220px" />
  </div>

  <template v-else-if="snapshot">
    <div class="text-sm text-surface-700 dark:text-surface-0 mb-1">
      В планах <b>{{ snapshot.backlog.total }}</b>, из них без движения дольше {{ STALE_DAYS }} дней —
      <b>{{ snapshot.backlog.staleCount }}</b>. Медианный возраст — <b>{{ snapshot.backlog.medianAge ?? '—' }}</b> дней,
      85-й перцентиль — <b>{{ snapshot.backlog.p85Age ?? '—' }}</b> дней.
    </div>

    <DynamicsChart
      :chart-data="chartData"
      stacked
      y-title="Задачи"
      :aspect-ratio="3"
    >
      <template #actions>
        <ExportButtons
          :headers="exportHeaders"
          :rows="exportRows"
          file-name="task-dynamics-backlog.csv"
          :copy-separator="copySeparator"
          :csv-separator="csvSeparator"
        />
      </template>
    </DynamicsChart>

    <div class="grid grid-cols-2 gap-4 mt-4">
      <div>
        <div class="text-sm font-semibold text-surface-700 dark:text-surface-0 mb-1">
          Взято в текущий спринт: {{ snapshot.sprint.total }}
        </div>
        <p class="text-xs text-surface-500 dark:text-surface-400 mb-2">
          Незакрытые задачи всех колонок, кроме планов и исключённых. Сюда попадают и задачи, которые уже
          доехали до последней колонки и ждут закрытия на итогах спринта.
        </p>
        <DataTable
          :value="snapshot.sprint.byStage"
          data-key="stageId"
          size="small"
          striped-rows
          show-gridlines
        >
          <Column
            field="name"
            header="Колонка"
          />
          <Column
            field="total"
            header="Задач"
          />
          <Column header="Медианный возраст">
            <template #body="{data}">
              {{ data.medianAge ?? '—' }} дн.
            </template>
          </Column>

          <template #empty>
            Нет данных
          </template>
        </DataTable>
      </div>

      <div v-if="excludedStages.length">
        <div class="text-sm font-semibold text-surface-700 dark:text-surface-0 mb-1">
          Исключено из расчётов: {{ snapshot.excluded.total }}
        </div>
        <p class="text-xs text-surface-500 dark:text-surface-400 mb-2">
          Колонки, помеченные как архивные. Они не попадают ни в планы, ни в текущий спринт — иначе возраст
          очереди всегда показывал бы катастрофу и никогда не менялся.
        </p>
        <DataTable
          :value="excludedStages"
          data-key="stageId"
          size="small"
          striped-rows
          show-gridlines
          class="opacity-60"
        >
          <Column
            field="name"
            header="Колонка"
          />
          <Column
            field="total"
            header="Задач"
          />
          <Column header="Медианный возраст">
            <template #body="{data}">
              {{ data.medianAge ?? '—' }} дн.
            </template>
          </Column>

          <template #empty>
            Нет данных
          </template>
        </DataTable>
      </div>
    </div>

    <p class="text-xs text-surface-500 dark:text-surface-400 mt-3">
      Срез на {{ snapshotLabel ?? 'момент загрузки' }} — без бакетов и дельт: колонка в задаче хранится
      только текущая, истории переходов у неё нет. Возраст считается от даты создания задачи, давность
      активности — от последнего изменения.
    </p>
  </template>
</template>
