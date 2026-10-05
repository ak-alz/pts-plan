<script setup>
defineProps({
  task: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <i
    v-if="task.isRootTask"
    v-tooltip.top="'Корневая задача'"
    class="pi pi-sitemap text-surface-400 dark:text-surface-500 mr-1"
  />
  <a
    v-if="task.url"
    class="pts-blur"
    target="_top"
    :href="task.url"
  >{{ task.name }}</a>
  <span
    v-else
    class="pts-blur text-surface-500 dark:text-surface-400"
  >{{ task.name }}</span>
</template>
