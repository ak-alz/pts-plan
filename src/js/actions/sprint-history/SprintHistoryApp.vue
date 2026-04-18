<script setup>
import { Dialog, Toast } from 'primevue';
import { ref } from 'vue';

import SprintHistoryMain from './components/SprintHistory.vue';

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
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round --with-left-icon --with-collapsed-icon pts-btn-sprint-history"
    type="button"
    title="История спринтов"
    @click="modalOpened = true"
  >
    История
  </button>

  <Dialog
    v-model:visible="modalOpened"
    header="История спринта"
    dismissable-mask
    modal
  >
    <SprintHistoryMain
      :session-id
      :group-id
    />
  </Dialog>

  <Toast position="bottom-right" />
</template>
