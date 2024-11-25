<script setup>
defineProps({
  label: {
    type: String,
    default: '',
  },
});

const model = defineModel({
  type: String,
  required: true,
});
</script>

<template>
  <label class="color-picker">
    <input
      v-model="model"
      class="color-picker__element"
      type="color"
      v-bind="$attrs"
    >
    <span
      v-if="label"
      class="color-picker__label"
    >
      {{ label }}
    </span>
  </label>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
