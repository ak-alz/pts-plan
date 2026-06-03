<script setup>
import {Popover} from 'primevue';
import {computed, ref} from 'vue';

import {getPreview} from '../../js/previews.js';

const props = defineProps({
  tip: {
    type: String,
    default: '',
  },
  optionKey: {
    type: String,
    default: '',
  },
});

const previewUrl = computed(() => getPreview(props.optionKey));
const popover = ref(null);
const videoSrc = ref(null);

function showPopover(event) {
  if (previewUrl.value && !videoSrc.value) {
    videoSrc.value = previewUrl.value;
  }
  popover.value?.show(event);
}
</script>

<template>
  <i
    class="pi pi-question-circle text-surface-500 cursor-help"
    @mouseenter="showPopover($event)"
    @mouseleave="popover?.hide()"
  />
  <Popover
    ref="popover"
    :pt="{ root: { class: 'option-hint-popover', style: { pointerEvents: 'none' } } }"
  >
    <div class="flex w-[300px] flex-col gap-2">
      <video
        v-if="previewUrl"
        :src="videoSrc"
        class="w-full block rounded"
        autoplay
        loop
        muted
        playsinline
      />
      <div
        class="option-hint-text m-0 text-xs text-surface-700"
        v-html="tip"
      />
    </div>
  </Popover>
</template>

<style>
.option-hint-popover::before,
.option-hint-popover::after {
  display: none;
}

.option-hint-text p + p {
  margin-top: 0.5em;
}
</style>
