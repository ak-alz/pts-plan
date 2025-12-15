<script setup>
import { Dialog, Toast } from 'primevue';
import { ref } from 'vue';

import ScrumSummary from './components/ScrumSummary.vue';

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
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round"
    type="button"
    @click="modalOpened = true"
  >
    Scrum-сводка
  </button>

  <Dialog
    v-model:visible="modalOpened"
    header="Сводка по спринтам"
    dismissable-mask
    modal
  >
    <ScrumSummary
      :session-id
      :group-id
    />
  </Dialog>

  <Toast position="bottom-right" />
</template>

<style scoped>

</style>
