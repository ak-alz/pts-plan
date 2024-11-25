<script setup>
import VIcon from '@/vue/ui/icon/VIcon.vue';

defineProps({
  label: {
    type: String,
    default: '',
  },
});

const model = defineModel({
  type: Boolean,
  required: true,
});
</script>

<template>
  <label class="checkbox">
    <input
      v-bind="$attrs"
      v-model="model"
      class="checkbox__element"
      type="checkbox"
    >
    <span class="checkbox__fake">
      <VIcon name="checkbox" />
    </span>
    <span
      v-if="label"
      class="checkbox__label"
    >
      {{ label }}
    </span>
  </label>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
