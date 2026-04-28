<script setup>
import dayjs from 'dayjs';
import Chart from 'primevue/chart';
import {computed} from 'vue';

const props = defineProps({
  users: {
    type: Array,
    default() {
      return [];
    },
  },
  trendMode: {
    type: Boolean,
    default: false,
  },
});

const chartData = computed(() => {
  return {
    datasets: props.users.map((user) => ({
      label: user.name,
      data: props.trendMode ? (user.trendLine ?? user.visibleSprints) : user.visibleSprints,
      showLine: true,
      borderWidth: props.trendMode ? 2 : 1,
      tension: props.trendMode ? 0 : 0.1,
      cubicInterpolationMode: props.trendMode ? undefined : 'monotone',
      borderColor: user.color,
      pointBackgroundColor: user.color,
    })),
  };
});

const chartOptions = computed(() => {
  const isTrend = props.trendMode;

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
            const { sprint, x } = tooltipItems[0]?.raw ?? {};
            if (isTrend) {
              const isEnd = tooltipItems[0].dataIndex === 1;
              return `${isEnd ? 'Конец' : 'Начало'} тренда (${dayjs(x).format('DD.MM.YYYY')})`;
            }
            return `Итоги спринта №${sprint} (${dayjs(x).format('DD.MM.YYYY')})`;
          },
          label(context) {
            if (isTrend) {
              const [start, end] = context.dataset.data;
              const delta = end.y - start.y;
              const sign = delta >= 0 ? '+' : '';
              const pct = start.y === 0 ? 100 : Math.round((delta / start.y) * 100);
              return `${context.dataset.label}: ${context.parsed.y} (${sign}${delta}, ${sign}${pct}%)`;
            }
            return `${context.dataset.label}: ${context.parsed.y}`;
          },
          footer: isTrend ? undefined : function(tooltipItems) {
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
          text: 'Дата спринта',
          align: 'end',
          display: true,
        },
        ticks: {
          callback: (value) => dayjs(value).format('DD.MM.YY'),
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
