<script setup>
import Chart from 'primevue/chart';

defineProps({
  chartData: {
    type: Object,
    required: true,
  },
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
  <Chart
    type="line"
    :data="chartData"
    :options="chartOptions"
  />
</template>
