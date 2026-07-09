<script setup>
import {SelectButton} from 'primevue';
import Chart from 'primevue/chart';
import {nextTick, ref, watch} from 'vue';

const props = defineProps({
  chartData: {
    type: Object,
    required: true,
  },
});

const chartRef = ref(null);
const visibleDatasets = ref(['points', 'tasks']);

const datasetOptions = [
  {label: 'Баллы', value: 'points'},
  {label: 'Задачи', value: 'tasks'},
];

function applyVisibility() {
  const chart = chartRef.value?.chart;
  if (!chart) return;
  chart.data.datasets.forEach((dataset, index) => {
    const key = dataset.yAxisID === 'y' ? 'points' : 'tasks';
    chart.setDatasetVisibility(index, visibleDatasets.value.includes(key));
  });
  chart.update();
}

watch(visibleDatasets, applyVisibility);

watch(() => props.chartData, () => {
  visibleDatasets.value = ['points', 'tasks'];
  nextTick(() => applyVisibility());
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 3,
  animation: false,
  interaction: {
    intersect: false,
    mode: 'x',
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {usePointStyle: true},
    },
    tooltip: {
      itemSort(a, b) {
        return b.raw.y - a.raw.y;
      },
      callbacks: {
        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`,
      },
    },
  },
  scales: {
    x: {
      type: 'category',
      ticks: {
        autoSkip: true,
        maxRotation: 45,
      },
    },
    y: {
      position: 'left',
      title: {display: true, text: 'Баллы', align: 'end'},
    },
    y1: {
      position: 'right',
      title: {display: true, text: 'Задачи', align: 'end'},
      grid: {drawOnChartArea: false},
    },
  },
};
</script>

<template>
  <div class="flex justify-end mb-2">
    <SelectButton
      v-model="visibleDatasets"
      :options="datasetOptions"
      option-label="label"
      option-value="value"
      multiple
      size="small"
    />
  </div>
  <Chart
    ref="chartRef"
    type="scatter"
    :data="chartData"
    :options="chartOptions"
  />
</template>
