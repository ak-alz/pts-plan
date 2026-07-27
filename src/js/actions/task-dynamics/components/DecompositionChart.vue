<script setup>
import {computed} from 'vue';

import {colors} from '../../../utils.js';
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

const sizeShades = Object.values(colors.indigo).slice(2, 10);

const sizes = computed(() => {
  const allSizes = new Set();
  props.rows.forEach((row) => row.sizeDistribution.forEach((segment) => allSizes.add(segment.points)));
  return [...allSizes].sort((a, b) => a - b);
});

const chartData = computed(() => ({
  labels: props.rows.map((row) => row.label),
  datasets: [
    ...sizes.value.map((size, index) => barDataset({
      label: `${size} б.`,
      data: props.rows.map((row) => {
        const segment = row.sizeDistribution.find((item) => item.points === size);
        if (!segment) return 0;
        return props.valueMode === 'share' ? segment.share : segment.count;
      }),
      color: sizeShades[index % sizeShades.length],
      valueSuffix: props.valueMode === 'share' ? '%' : '',
      stack: 'sizes',
    })),
    lineDataset({
      label: 'Задач на корневую',
      data: props.rows.map((row) => row.subtasksPerRoot),
      color: CHART_COLORS.decompositionRatio,
      pointStyle: 'rectRot',
    }),
  ],
}));

const exportHeaders = computed(() => [
  'Бакет',
  'Закрыто задач',
  'Корневых',
  'Задач на корневую',
  ...sizes.value.map((size) => `${size} б.`),
]);

const exportRows = computed(() => props.rows.map((row) => [
  row.label,
  row.closed,
  row.roots,
  row.subtasksPerRoot,
  ...sizes.value.map((size) => {
    const segment = row.sizeDistribution.find((item) => item.points === size);
    if (!segment) return 0;
    return props.valueMode === 'share' ? segment.share : segment.count;
  }),
]));
</script>

<template>
  <DynamicsChart
    :chart-data="chartData"
    :milestones="milestones"
    stacked
    :y-title="valueMode === 'share' ? '% задач с баллами' : 'Задачи'"
    y1-title="Задач на корневую"
  >
    <template #actions>
      <ExportButtons
        :headers="exportHeaders"
        :rows="exportRows"
        file-name="task-dynamics-decomposition.csv"
        :copy-separator="copySeparator"
        :csv-separator="csvSeparator"
      />
    </template>
  </DynamicsChart>
  <p class="text-xs text-surface-500 dark:text-surface-400 mt-2">
    Столбцы — распределение закрытых задач по баллам; задачи без баллов в названии в него не попадают,
    поэтому переключатель «Доли» считает проценты от задач с баллами. Линия всегда считается по всем
    задачам и разрез не применяет — иначе в разрезе «только корневые» пришлось бы делить одно множество
    на само себя и получалась бы ровно единица. Считается она плоско, по задачам периода: родителей вверх
    виджет не обходит (это сотни лишних запросов), поэтому если родитель закрыт вне периода, его подзадачи
    внутри периода посчитаются как отдельные корни — значение приблизительное и может расходиться
    с коэффициентом декомпозиции в «Анализе баллов задач».
  </p>
</template>
