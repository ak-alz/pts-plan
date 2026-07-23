<script setup>
import { Dialog } from 'primevue';
import { ref } from 'vue';

import ExportTask from './components/ExportTask.vue';

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
    class="export-task-button"
    type="button"
    title="Экспортировать задачу"
    @click="modalOpened = true"
  >
    <i class="pi pi-download" />
  </button>

  <Dialog
    v-model:visible="modalOpened"
    header="Экспорт задачи"
    modal
    :style="{ width: '460px' }"
  >
    <ExportTask
      :session-id
      :task-id
    />
  </Dialog>
</template>
