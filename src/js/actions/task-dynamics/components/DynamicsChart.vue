<script setup>
import {SelectButton} from 'primevue';
import Chart from 'primevue/chart';
import {computed, nextTick, ref, watch} from 'vue';

import {useContentTheme} from '../../../composables/useContentTheme.js';

const props = defineProps({
  chartData: {
    type: Object,
    required: true,
  },
  yTitle: {
    type: String,
    default: '',
  },
  y1Title: {
    type: String,
    default: '',
  },
  milestones: {
    type: Array,
    default: () => [],
  },
  stacked: {
    type: Boolean,
    default: false,
  },
  aspectRatio: {
    type: Number,
    default: 2.6,
  },
});

const {isDark} = useContentTheme();

const textColor = computed(() => (isDark.value ? '#a1a1aa' : '#52525b'));
const gridColor = computed(() => (isDark.value ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)'));
const milestoneColor = computed(() => (isDark.value ? '#a1a1aa' : '#71717a'));

const chartRef = ref(null);
const visibleLabels = ref([]);

const datasetOptions = computed(() => (props.chartData?.datasets ?? []).map((dataset) => ({
  label: dataset.label,
  value: dataset.label,
})));

const hasSecondAxis = computed(() => (props.chartData?.datasets ?? []).some((dataset) => dataset.yAxisID === 'y1'));

function applyVisibility() {
  const chart = chartRef.value?.chart;
  if (!chart) return;
  chart.data.datasets.forEach((dataset, index) => {
    chart.setDatasetVisibility(index, visibleLabels.value.includes(dataset.label));
  });
  chart.update();
}

watch(() => props.chartData, (data) => {
  visibleLabels.value = (data?.datasets ?? []).map((dataset) => dataset.label);
  nextTick(applyVisibility);
}, {immediate: true});

watch(visibleLabels, applyVisibility);

// События рисует плагин, а он читает props только в момент отрисовки. Chart следит лишь за data
// и options, поэтому сохранённое в настройках событие иначе появилось бы на графике не сразу,
// а когда независимо изменятся данные, период или тема
watch(() => props.milestones, () => { chartRef.value?.chart?.update(); });

function formatValue(value, dataset) {
  if (value === null || value === undefined) return '—';
  return `${value}${dataset.valueSuffix ?? ''}`;
}

// Вертикальные линии событий своим плагином: annotation-плагин Chart.js тянуть в расширение ради
// пары линий не стоит, а рисование по индексу бакета занимает десяток строк
const milestonePlugin = {
  id: 'ptsMilestones',
  afterDatasetsDraw(chart) {
    if (!props.milestones.length) return;
    const {ctx, chartArea, scales} = chart;
    const labelCount = Math.max(1, chart.data.labels?.length ?? 1);
    const categoryWidth = chartArea.width / labelCount;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = milestoneColor.value;
    ctx.fillStyle = milestoneColor.value;
    ctx.font = '10px sans-serif';

    props.milestones.forEach((milestone) => {
      const center = scales.x.getPixelForValue(milestone.bucketIndex);
      const x = Math.min(
        chartArea.right,
        Math.max(chartArea.left, center - categoryWidth / 2 + milestone.positionInBucket * categoryWidth),
      );

      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();

      ctx.save();
      ctx.translate(x + 3, chartArea.top + 3);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(milestone.label, 0, 0);
      ctx.restore();
    });

    ctx.restore();
  },
};

const chartPlugins = [milestonePlugin];

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: props.aspectRatio,
  animation: false,
  interaction: {intersect: false, mode: 'index'},
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {usePointStyle: true, color: textColor.value},
    },
    tooltip: {
      // Порядок строк в подсказке иначе следует за порядком отрисовки (order), из-за которого линии
      // выводятся поверх столбцов, — а читать удобнее в том порядке, в котором датасеты объявлены
      itemSort: (first, second) => first.datasetIndex - second.datasetIndex,
      callbacks: {
        label: (context) => `${context.dataset.label}: ${formatValue(context.parsed.y, context.dataset)}`,
      },
    },
  },
  scales: {
    x: {
      stacked: props.stacked,
      ticks: {autoSkip: true, maxRotation: 45, color: textColor.value},
      grid: {color: gridColor.value},
    },
    y: {
      stacked: props.stacked,
      position: 'left',
      beginAtZero: true,
      title: {display: !!props.yTitle, text: props.yTitle, align: 'end', color: textColor.value},
      ticks: {color: textColor.value},
      grid: {color: gridColor.value},
    },
    y1: {
      display: hasSecondAxis.value,
      position: 'right',
      beginAtZero: true,
      title: {display: !!props.y1Title, text: props.y1Title, align: 'end', color: textColor.value},
      ticks: {color: textColor.value},
      grid: {drawOnChartArea: false},
    },
  },
}));

</script>

<template>
  <!-- Слот actions — место для кнопок выгрузки вкладки: так у графика одна строка управления вместо двух -->
  <div class="flex justify-between items-center gap-2 mb-2 flex-wrap">
    <SelectButton
      v-model="visibleLabels"
      :options="datasetOptions"
      option-label="label"
      option-value="value"
      multiple
      size="small"
    />
    <slot name="actions" />
  </div>
  <Chart
    ref="chartRef"
    type="bar"
    :data="chartData"
    :options="chartOptions"
    :plugins="chartPlugins"
  />
</template>
