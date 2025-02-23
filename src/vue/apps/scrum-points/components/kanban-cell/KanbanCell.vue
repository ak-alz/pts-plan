<script setup>
import { computed, inject } from 'vue';

const props = defineProps({
  column: {
    type: Object,
    required: true,
  },
});

const settings = inject('settings');

const color = computed(() => props.column.color);

const title = computed(() => {
  if (settings.value.compactMode) {
    return props.column.name
      .split(' ')
      .map((x) => x.trim())
      .filter((x) => !!x)
      .map((x) => x.substring(0, 1).toUpperCase())
      .join('');
  }

  return `${props.column.name} (${props.column.total})`;
});

const tip = computed(() => {
  if (settings.value.compactMode) {
    return `${props.column.name} (${props.column.total})`;
  }

  return null;
});
</script>

<template>
  <th v-bind="$attrs" class="kanban-cell" :title="tip">
    {{ title }}
  </th>
</template>

<style scoped
       lang="scss"
>
.kanban-cell {
  text-align: center !important;
  color: white;

  background-color: v-bind(color) !important;
}
</style>
