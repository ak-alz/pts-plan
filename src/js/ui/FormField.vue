<script setup>
defineProps({
  id: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    default: '',
  },
  tip: {
    type: String,
    default: '',
  },
});
</script>

<template>
  <div>
    <component
      :is="id ? 'label' : 'div'"
      v-if="label"
      :for="id"
      class="flex gap-2 mb-1 text-surface-500 text-sm font-semibold"
    >
      {{ label }}
      <i
        v-if="tip"
        v-tooltip="tip"
        class="pi pi-question-circle"
      />
    </component>
    <div>
      <slot />
    </div>
  </div>
</template>

<style scoped>

</style>
