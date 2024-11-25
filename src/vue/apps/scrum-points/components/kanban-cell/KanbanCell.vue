<script setup>
import { computed } from 'vue';

const props = defineProps({
  column: {
    type: Object,
    required: true,
  },
});

const color = computed(() => props.column.color);
</script>

<template>
  <th class="kanban-cell">
    {{ props.column.name }} ({{ props.column.total }})
  </th>
</template>

<style scoped
       lang="scss"
>
.kanban-cell {
  color: white;

  background-color: v-bind(color) !important;
}
</style>
