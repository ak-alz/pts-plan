<script setup>
import Chart from 'primevue/chart';
import {computed} from 'vue';

import {getTaskPointsFromName, stringToPastelColor} from '../../../utils.js';

const props = defineProps({
  allUserTasksPerUser: {type: Array, required: true},
  users: {type: Array, default: () => []},
});

const chartData = computed(() => {
  const allPointValues = new Set();
  props.allUserTasksPerUser.forEach(({tasks}) => {
    tasks.forEach((task) => {
      const pts = getTaskPointsFromName(task.title);
      if (pts > 0) allPointValues.add(pts);
    });
  });
  const labels = [...allPointValues].sort((a, b) => a - b);

  const multiUser = props.allUserTasksPerUser.length > 1;

  return {
    labels,
    datasets: props.allUserTasksPerUser.map(({userId, tasks}) => {
      const name = props.users.find((u) => u.id === userId)?.name ?? userId;
      const counts = Object.fromEntries(labels.map((l) => [l, 0]));
      tasks.forEach((task) => {
        const pts = getTaskPointsFromName(task.title);
        if (pts in counts) counts[pts]++;
      });
      return {
        label: multiUser ? name : 'Задач',
        data: labels.map((l) => counts[l]),
        backgroundColor: stringToPastelColor(name) + 'bb',
        borderRadius: 4,
        minBarLength: 4,
      };
    }),
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 3,
  animation: false,
  plugins: {
    legend: {
      display: props.allUserTasksPerUser.length > 1,
      position: 'bottom',
      labels: {usePointStyle: true},
    },
  },
  scales: {
    x: {title: {display: true, text: 'Баллы', align: 'end'}},
    y: {
      beginAtZero: true,
      ticks: {stepSize: 1},
      title: {display: true, text: 'Задач', align: 'end'},
    },
  },
}));
</script>

<template>
  <Chart
    type="bar"
    :data="chartData"
    :options="chartOptions"
  />
</template>
