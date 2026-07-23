<script setup>
import {Button} from 'primevue';

import SetupFeatureCard from './SetupFeatureCard.vue';

defineProps({
  features: {
    type: Array,
    required: true,
  },
  model: {
    type: Object,
    required: true,
  },
});

defineEmits(['toggle', 'enable-all']);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="!features.length"
      class="flex flex-col items-center gap-2 py-10 text-center"
    >
      <i class="pi pi-check-circle text-3xl text-surface-300 dark:text-surface-600" />
      <p class="m-0 text-sm text-surface-500 dark:text-surface-400">
        Под ваши ответы новых функций не нашлось — похоже, нужное уже включено.
      </p>
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-3">
        <p class="m-0 text-sm text-surface-600 dark:text-surface-300">
          Включите нужные функции:
        </p>
        <Button
          label="Включить всё"
          size="small"
          severity="secondary"
          outlined
          @click="$emit('enable-all')"
        />
      </div>

      <div class="flex flex-col gap-3">
        <SetupFeatureCard
          v-for="feature in features"
          :key="feature.key"
          :feature="feature"
          :enabled="!!model[feature.key]"
          @update:enabled="$emit('toggle', feature, $event)"
        />
      </div>
    </template>
  </div>
</template>
