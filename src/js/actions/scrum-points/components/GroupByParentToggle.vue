<script setup>
import { ToggleSwitch } from 'primevue';
import { inject } from 'vue';

const { groupByParent, loadingAncestors } = inject('taskGrouping');
</script>

<template>
  <div class="flex items-center gap-2 select-none mb-3">
    <ToggleSwitch
      v-model="groupByParent"
      input-id="scrum-points-group-by-parent"
      size="small"
    />
    <label
      for="scrum-points-group-by-parent"
      class="text-sm cursor-pointer"
    >Группировать по родительской задаче</label>
    <i
      v-if="loadingAncestors"
      class="pi pi-spinner pi-spin text-surface-400 dark:text-surface-500"
    />
  </div>
</template>
