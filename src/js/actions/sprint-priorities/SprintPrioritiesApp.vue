<script setup>
import { Dialog, Toast } from 'primevue';
import { ref } from 'vue';

import SprintPriorities from './components/SprintPriorities.vue';

defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
});

const modalOpened = ref(false);
</script>

<template>
  <button
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round --with-left-icon --with-collapsed-icon"
    type="button"
    title="Приоритеты спринта"
    @click="modalOpened = true"
  >
    Приоритеты
  </button>

  <Dialog
    v-model:visible="modalOpened"
    header="Приоритеты спринта"
    dismissable-mask
    modal
    :style="{ width: '1100px', maxWidth: '95vw' }"
  >
    <SprintPriorities
      :session-id
      :group-id
    />
  </Dialog>

  <Toast
    group="sprint-priorities"
    position="bottom-right"
  />
</template>
