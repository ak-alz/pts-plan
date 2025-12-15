<script setup>
import 'vue-color/style.css';

import { Popover } from 'primevue';
import { ref } from 'vue';
import { TwitterPicker } from 'vue-color';

defineProps({
  id: {
    type: String,
    default: '',
  },
  presetColors: {
    type: Array,
    default() {
      return [];
    },
  },
});

const model = defineModel({
  type: String,
  default: '',
});

const op = ref();

const toggle = (event) => {
  op.value.toggle(event);
};
</script>

<template>
  <button
    :id
    class="w-3 h-3 rounded-[50%] cursor-pointer"
    :style="`background-color: ${model};`"
    type="button"
    @click="toggle"
  />

  <Popover ref="op">
    <slot name="before" />
    <TwitterPicker
      v-model="model"
      :width="210"
      :preset-colors
      triangle="hide"
    />
    <slot name="after" />
  </Popover>
</template>

<style scoped>
.vc-twitter-picker {
  border: none;
  box-shadow: none;
  background: none;
}

.vc-twitter-picker :deep(.body) {
  padding: 0;
  margin-right: -6px;
  margin-bottom: -6px;
  width: calc(100% + 6px);
  height: calc(100% + 6px);
}
</style>
