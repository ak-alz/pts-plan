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
  author: {
    type: String,
    default: '',
  },
});

const previewUrl = computed(() => getPreview(props.optionKey));
const popover = ref(null);
const videoSrc = ref(null);
let hideTimeout = null;

function showPopover(event) {
  clearTimeout(hideTimeout);
  if (previewUrl.value && !videoSrc.value) {
    videoSrc.value = previewUrl.value;
  }
  popover.value?.show(event);
}

// Подсказка почти всегда открывается поверх самой иконки, поэтому курсору дают время перейти на неё
function scheduleHide() {
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => popover.value?.hide(), 150);
}

function cancelHide() {
  clearTimeout(hideTimeout);
}
</script>

<template>
  <i
    class="pi pi-question-circle text-surface-500 dark:text-surface-400 cursor-help"
    @mouseenter="showPopover($event)"
    @mouseleave="scheduleHide"
  />
  <Popover
    ref="popover"
    :pt="{ root: { class: 'option-hint-popover', onMouseenter: cancelHide, onMouseleave: scheduleHide } }"
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
        class="option-hint-text m-0 text-xs text-surface-700 dark:text-surface-0"
        v-html="tip"
      />
      <div
        v-if="author"
        class="text-xs italic text-primary"
      >
        Идея: {{ author }}
      </div>
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
