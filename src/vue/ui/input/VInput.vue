<script setup>
defineProps({
  type: {
    type: String,
    default: 'text',
  },
  label: {
    type: String,
    default: '',
  },
  withIcon: {
    type: Boolean,
    default: false,
  },
});

const model = defineModel({
  type: [String, Number],
  required: true,
});
</script>

<template>
  <label
    class="input"
    :class="{
      'with-icon': withIcon,
    }"
  >
    <span
      v-if="label"
      class="input__label"
    >
      {{ label }}
    </span>
    <input
      v-model.trim="model"
      class="input__element"
      :type
      v-bind="$attrs"
    >
  </label>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
