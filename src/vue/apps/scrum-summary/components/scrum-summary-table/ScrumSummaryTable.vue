<script setup>
import { computed, inject } from 'vue';

const props = defineProps({
  chartInstance: {
    type: Object,
    required: true,
  },
  users: {
    type: Array,
    default() {
      return [];
    },
  },
});

const settings = inject('settings');

function getMedian(values) {
  if (values.length === 0) {
    throw new Error('Input array is empty');
  }

  values = [...values].sort((a, b) => a - b);

  const half = Math.floor(values.length / 2);

  return (values.length % 2
    ? values[half]
    : (values[half - 1] + values[half]) / 2
  );
}

const data = computed(() => props.users
  .filter(({ id }) => settings.value.users[id])
  .map((user) => {
    const color = props.chartInstance?.chart?.data?.datasets
      ?.find(({ label }) => label === user.name)?.borderColor || 'transparent';

    let firstSprintIndex = user.points.findIndex((point) => point);
    let sprintsCount = user.points.length - firstSprintIndex;
    let avgPoint = 0;
    let median = 0;

    if (firstSprintIndex >= 0) {
      if (settings.value.sprintsCount) {
        sprintsCount = Math.min(user.points.length - firstSprintIndex, settings.value.sprintsCount);
        firstSprintIndex = Math.max(firstSprintIndex, user.points.length - sprintsCount);
      }

      const realSprints = user.points.slice(firstSprintIndex);

      avgPoint = realSprints.reduce((acc, point) => acc + point, 0) / sprintsCount;

      median = getMedian(realSprints);
    }

    return {
      id: user.id,
      name: user.name,
      url: user.url,
      color,
      sprintsCount,
      avgPoint: Math.round(avgPoint * 100) / 100,
      median,
    };
  })
  .sort((a, b) => b.avgPoint - a.avgPoint));
</script>

<template>
  <div class="scrum-points-table">
    <table class="scrum-points-table__table">
      <thead>
        <tr>
          <th>Цвет</th>
          <th>Пользователь</th>
          <th>Спринтов</th>
          <th>Средний балл</th>
          <th>Медианный балл</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in data" :key="user.id">
          <td :style="`background-color: ${user.color};`" />
          <td>
            <a :href="user.url">{{ user.name }}</a>
          </td>
          <td class="a-center">
            {{ user.sprintsCount }}
          </td>
          <td class="a-center">
            {{ user.avgPoint }}
          </td>
          <td class="a-center">
            {{ user.median }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
