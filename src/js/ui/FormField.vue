<script setup>
import { computed } from 'vue';

const props = defineProps({
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
  tipInteractive: {
    type: Boolean,
    default: false,
  },
});

// autoHide: false оставляет подсказку открытой, пока курсор внутри неё — иначе из подсказки
// ничего нельзя выделить и скопировать
const tooltipOptions = computed(() => ({ value: props.tip, autoHide: !props.tipInteractive }));
</script>

<template>
  <div>
    <component
      :is="id ? 'label' : 'div'"
      v-if="label"
      :for="id ? id : null"
      class="flex gap-2 mb-1 text-surface-500 dark:text-surface-400 text-sm font-semibold"
    >
      {{ label }}
      <i
        v-if="tip"
        v-tooltip="tooltipOptions"
        class="pi pi-question-circle text-surface-500 dark:text-surface-400"
      />
    </component>
    <div>
      <slot />
    </div>
  </div>
</template>

