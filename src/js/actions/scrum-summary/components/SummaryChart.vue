<script setup>
import Chart from 'primevue/chart';
import { computed } from 'vue';

const props = defineProps({
  users: {
    type: Array,
    default() {
      return [];
    },
  },
});

const chartData = computed(() => {
  return {
    datasets: props.users.map((user) => ({
      label: user.name,
      data: user.visibleSprints,
      showLine: true,
      borderWidth: 1,
      tension: 0.1,
      cubicInterpolationMode: 'monotone',
      borderColor: user.color,
      pointBackgroundColor: user.color,
    })),
  };
});

const chartOptions = computed(() => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: true,
      mode: 'x',
    },
    animation: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'rectRounded',
        },
      },
      tooltip: {
        itemSort(a, b) {
          return b.raw.y - a.raw.y;
        },
        callbacks: {
          title(tooltipItems) {
            return `Итоги спринта №${tooltipItems[0]?.parsed?.x}`;
          },
          label(context) {
            return `${context.dataset.label}: ${context.parsed.y}`;
          },
          footer(tooltipItems) {
            let sum = 0;

            tooltipItems.forEach((tooltipItem) => {
              sum += tooltipItem.parsed.y;
            });

            return `Итого: ${sum}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          text: 'Спринт',
          align: 'end',
          display: true,
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          align: 'end',
          text: 'Баллы',
        },
      },
    },
  };
});
</script>

<template>
  <Chart
    style="min-height: 400px; width: 1000px;"
    type="scatter"
    :data="chartData"
    :options="chartOptions"
  />
</template>

<style scoped>

</style>
