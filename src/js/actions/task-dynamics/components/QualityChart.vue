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

const hotfixChartData = computed(() => ({
  labels: props.rows.map((row) => row.label),
  datasets: [
    barDataset({label: 'Хотфиксов', data: props.rows.map((row) => row.hotfixes), color: CHART_COLORS.hotfixes}),
    lineDataset({
      label: 'Доля от закрытых',
      data: props.rows.map((row) => row.hotfixShare),
      color: CHART_COLORS.hotfixShare,
      valueSuffix: '%',
      pointStyle: 'rectRot',
    }),
  ],
}));

const leadTimeChartData = computed(() => ({
  labels: props.rows.map((row) => row.label),
  datasets: [
    lineDataset({
      label: 'Хотфиксы: медиана, дней',
      data: props.rows.map((row) => row.hotfixLeadTimeMedian),
      color: CHART_COLORS.hotfixes,
      yAxisID: 'y',
      valueSuffix: ' дн.',
    }),
    lineDataset({
      label: 'Обычные задачи: медиана, дней',
      data: props.rows.map((row) => row.regularLeadTimeMedian),
      color: CHART_COLORS.regularLeadTime,
      yAxisID: 'y',
      valueSuffix: ' дн.',
      dash: [6, 4],
    }),
    lineDataset({
      label: 'Комментариев на задачу',
      data: props.rows.map((row) => row.commentsPerTask),
      color: CHART_COLORS.comments,
      pointStyle: 'rectRot',
    }),
  ],
}));

const exportHeaders = ['Бакет', 'Закрыто задач', 'Хотфиксов', 'Доля хотфиксов, %', 'Хотфиксы: медиана, дней', 'Обычные задачи: медиана, дней', 'Комментариев на задачу'];
const exportRows = computed(() => props.rows.map((row) => [
  row.label,
  row.closed,
  row.hotfixes,
  row.hotfixShare,
  row.hotfixLeadTimeMedian ?? '',
  row.regularLeadTimeMedian ?? '',
  row.commentsPerTask,
]));
</script>

<template>
  <DynamicsChart
    :chart-data="hotfixChartData"
    :milestones="milestones"
    y-title="Задачи"
    y1-title="%"
  >
    <template #actions>
      <ExportButtons
        :headers="exportHeaders"
        :rows="exportRows"
        file-name="task-dynamics-quality.csv"
        :copy-separator="copySeparator"
        :csv-separator="csvSeparator"
      />
    </template>
  </DynamicsChart>
  <p class="text-xs text-surface-500 dark:text-surface-400 mt-2 mb-4">
    Хотфиксы определяются по названию задачи (начинается с «Hotfix»): колонка канбана для истории
    бесполезна — закрытая задача всегда уезжает в архивную колонку, откуда бы она ни пришла.
    Эта вкладка всегда считается по всем задачам и общий разрез не применяет: хотфиксы часто заводят
    подзадачами, и в разрезе «только корневые» их доля оказалась бы заниженной.
  </p>

  <DynamicsChart
    :chart-data="leadTimeChartData"
    :milestones="milestones"
    y-title="Дни"
    y1-title="Комментарии"
  />
  <p class="text-xs text-surface-500 dark:text-surface-400 mt-2">
    Время у хотфиксов сравнивается со временем обычных задач: хотфикс в планах почти не лежит, поэтому
    его медиана показывает, за сколько задачу реально делают, а разрыв между линиями — сколько времени
    обычная задача проводит в ожидании. Число комментариев Bitrix считает вместе с системными сообщениями,
    так что это косвенная мера уточнений, а не точный счётчик обсуждений.
  </p>
</template>
