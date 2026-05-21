<script setup>
import {Button} from 'primevue';
import Chart from 'primevue/chart';
import {nextTick, ref, watch} from 'vue';

const props = defineProps({
  chartData: {
    type: Object,
    required: true,
  },
});

const chartRef = ref(null);
const showPoints = ref(true);
const showTasks = ref(true);

function applyVisibility() {
  const chart = chartRef.value?.chart;
  if (!chart) return;
  chart.data.datasets.forEach((ds, i) => {
    chart.setDatasetVisibility(i, ds.yAxisID === 'y' ? showPoints.value : showTasks.value);
  });
  chart.update();
}

function toggleAll() {
  const allOn = showPoints.value && showTasks.value;
  showPoints.value = !allOn;
  showTasks.value = !allOn;
  applyVisibility();
}

function togglePoints() {
  showPoints.value = !showPoints.value;
  applyVisibility();
}

function toggleTasks() {
  showTasks.value = !showTasks.value;
  applyVisibility();
}

watch(() => props.chartData, () => {
  showPoints.value = true;
  showTasks.value = true;
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
  <div class="flex gap-1 justify-end mb-2">
    <Button
      label="Все"
      size="small"
      severity="secondary"
      :variant="showPoints && showTasks ? undefined : 'text'"
      @click="toggleAll"
    />
    <Button
      label="Баллы"
      size="small"
      severity="secondary"
      :variant="showPoints ? undefined : 'text'"
      @click="togglePoints"
    />
    <Button
      label="Задачи"
      size="small"
      severity="secondary"
      :variant="showTasks ? undefined : 'text'"
      @click="toggleTasks"
    />
  </div>
  <Chart
    ref="chartRef"
    type="scatter"
    :data="chartData"
    :options="chartOptions"
  />
</template>
