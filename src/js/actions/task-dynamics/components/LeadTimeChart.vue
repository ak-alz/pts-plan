<script setup>
import {computed} from 'vue';

import {barDataset, lineDataset} from '../chartDatasets.js';
import {CHART_COLORS} from '../variables.js';
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
    lineDataset({
      label: 'Медиана, дней',
      data: props.rows.map((row) => row.leadTimeMedian),
      color: CHART_COLORS.leadTimeMedian,
      yAxisID: 'y',
      valueSuffix: ' дн.',
    }),
    lineDataset({
      label: '85-й перцентиль, дней',
      data: props.rows.map((row) => row.leadTimeP85),
      color: CHART_COLORS.leadTimeP85,
      yAxisID: 'y',
      valueSuffix: ' дн.',
      dash: [6, 4],
      pointStyle: 'rectRot',
    }),
    barDataset({
      label: 'Средний размер задачи, баллов',
      data: props.rows.map((row) => row.avgPointsPerTask),
      color: CHART_COLORS.taskSize,
      yAxisID: 'y1',
    }),
  ],
}));

const exportHeaders = ['Бакет', 'Медиана, дней', '85-й перцентиль, дней', 'Средний размер задачи, баллов', 'Закрыто задач'];
const exportRows = computed(() => props.rows.map((row) => [
  row.label,
  row.leadTimeMedian ?? '',
  row.leadTimeP85 ?? '',
  row.avgPointsPerTask,
  row.closed,
]));
</script>

<template>
  <DynamicsChart
    :chart-data="chartData"
    :milestones="milestones"
    y-title="Дни"
    y1-title="Баллы"
  >
    <template #actions>
      <ExportButtons
        :headers="exportHeaders"
        :rows="exportRows"
        file-name="task-dynamics-lead-time.csv"
        :copy-separator="copySeparator"
        :csv-separator="csvSeparator"
      />
    </template>
  </DynamicsChart>
  <p class="text-xs text-surface-500 dark:text-surface-400 mt-2">
    Это полное время от постановки задачи до её закрытия, по дате закрытия. Внутри него сидят и ожидание
    в планах (месяцы), и ожидание конца спринта, когда итоги подводят пачкой — поэтому график
    отвечает на вопрос «сколько задача ждала, прежде чем её сделали», а не «как быстро работает команда».
    Меняется он в первую очередь от того, как ведут планы и выбирают приоритеты. Средних нет: распределение
    с длинным хвостом из долгожителей, только медиана и перцентиль.
  </p>
</template>
