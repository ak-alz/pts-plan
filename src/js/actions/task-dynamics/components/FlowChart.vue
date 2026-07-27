<script setup>
import {computed} from 'vue';

import {pluralize} from '../../../utils.js';
import {barDataset, lineDataset} from '../chartDatasets.js';
import {CHART_COLORS, MOVING_AVERAGE_WINDOW} from '../variables.js';
import DynamicsChart from './DynamicsChart.vue';
import ExportButtons from './ExportButtons.vue';

const props = defineProps({
  rows: {
    type: Array,
    required: true,
  },
  milestones: {
    type: Array,
    default: () => [],
  },
  backlogTotal: {
    type: Number,
    default: null,
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

const chartData = computed(() => ({
  labels: props.rows.map((row) => row.label),
  datasets: [
    barDataset({label: 'Создано', data: props.rows.map((row) => row.created), color: CHART_COLORS.created}),
    barDataset({label: 'Закрыто', data: props.rows.map((row) => row.closed), color: CHART_COLORS.closed}),
    lineDataset({
      label: `Закрытий: среднее за ${MOVING_AVERAGE_WINDOW}`,
      data: props.rows.map((row) => row.closedMovingAverage),
      color: CHART_COLORS.movingAverage,
      yAxisID: 'y',
      dash: [6, 4],
    }),
    lineDataset({
      label: 'Накопленный долг',
      data: props.rows.map((row) => row.cumulativeDebt),
      color: CHART_COLORS.debt,
      pointStyle: 'rectRot',
    }),
  ],
}));

const exportHeaders = ['Бакет', 'Создано', 'Закрыто', 'Нетто-долг', 'Накопленный долг', `Закрытий: среднее за ${MOVING_AVERAGE_WINDOW}`];
const exportRows = computed(() => props.rows.map((row) => [
  row.label,
  row.created,
  row.closed,
  row.netDebt,
  row.cumulativeDebt,
  row.closedMovingAverage ?? '',
]));

const backlogNote = computed(() => {
  if (props.backlogTotal === null) return '';
  return `Сейчас в планах ${props.backlogTotal} ${pluralize(props.backlogTotal, ['задача', 'задачи', 'задач'])}.`;
});
</script>

<template>
  <DynamicsChart
    :chart-data="chartData"
    :milestones="milestones"
    y-title="Задачи"
    y1-title="Долг"
  >
    <template #actions>
      <ExportButtons
        :headers="exportHeaders"
        :rows="exportRows"
        file-name="task-dynamics-flow.csv"
        :copy-separator="copySeparator"
        :csv-separator="csvSeparator"
      />
    </template>
  </DynamicsChart>
  <p class="text-xs text-surface-500 dark:text-surface-400 mt-2">
    Создание бакетируется по дате создания задачи, закрытие — по дате закрытия. Линия долга — накопленное
    изменение с начала периода, а не абсолютный объём планов: она всегда начинается около нуля.
    {{ backlogNote }}
  </p>
</template>
