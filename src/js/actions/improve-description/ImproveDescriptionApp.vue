<script setup>
import { Dialog } from 'primevue';
import { ref } from 'vue';

import ImproveDescription from './components/ImproveDescription.vue';

defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  taskId: {
    type: String,
    required: true,
  },
});

const modalOpened = ref(false);
</script>

<template>
  <button
    class="improve-description-button"
    type="button"
    title="Улучшить описание задачи с помощью ИИ"
    @click="modalOpened = true"
  >
    <i class="pi pi-sparkles" />
  </button>

  <Dialog
    v-model:visible="modalOpened"
    header="Улучшение описания задачи"
    modal
    :style="{ width: '760px' }"
  >
    <ImproveDescription
      :session-id
      :task-id
    />
  </Dialog>
</template>
