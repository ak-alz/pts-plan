<script setup>
defineProps({
  options: {
    type: Array,
    default() {
      return [];
    },
  },
  optionLabel: {
    type: String,
    default: 'label',
  },
  optionValue: {
    type: String,
    default: 'value',
  },
});

const model = defineModel({
  type: String,
  required: true,
});
</script>

<template>
  <label class="select">
    <select
      v-bind="$attrs"
      v-model="model"
      class="select__element"
    >
      <option
        v-for="option in options"
        :key="option[optionValue]"
        :value="option[optionValue]"
      >
        {{ option[optionLabel] }}
      </option>
    </select>
  </label>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
