<script setup>
import {ToggleSwitch} from 'primevue';
import {computed, ref} from 'vue';

import {getPreview} from '../../js/previews.js';

const props = defineProps({
  feature: {
    type: Object,
    required: true,
  },
  enabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['update:enabled']);

const previewUrl = computed(() => getPreview(props.feature.key));
const videoElement = ref(null);

function startPreview() {
  videoElement.value?.play();
}

function stopPreview() {
  if (!videoElement.value) return;
  videoElement.value.pause();
  videoElement.value.currentTime = 0;
}
</script>

<template>
  <div
    class="group flex gap-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 p-3"
    @mouseenter="startPreview"
    @mouseleave="stopPreview"
  >
    <div class="w-[300px] shrink-0">
      <video
        v-if="previewUrl"
        ref="videoElement"
        :src="previewUrl"
        :alt="feature.name"
        class="w-full block rounded-md opacity-40 group-hover:opacity-100 transition-opacity duration-300"
        preload="metadata"
        muted
        loop
        playsinline
      />
      <div
        v-else
        class="w-full aspect-[2/1] rounded-md bg-surface-100 dark:bg-surface-800 flex items-center justify-center"
      >
        <i class="pi pi-image text-3xl text-surface-300 dark:text-surface-600" />
      </div>
    </div>

    <div class="grow min-w-0 flex flex-col gap-1.5">
      <div class="flex items-start justify-between gap-2">
        <span class="text-sm font-medium text-surface-800 dark:text-surface-0">{{ feature.name }}</span>
        <ToggleSwitch
          :model-value="enabled"
          @update:model-value="$emit('update:enabled', $event)"
        />
      </div>
      <div
        class="setup-feature-tip m-0 text-[13px] leading-snug text-surface-500 dark:text-surface-400"
        v-html="feature.tip"
      />
    </div>
  </div>
</template>

<style scoped>
.setup-feature-tip p {
  margin: 0;
}

.setup-feature-tip p + p {
  margin-top: 0.5em;
}
</style>
