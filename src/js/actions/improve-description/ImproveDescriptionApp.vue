<script setup>
import { Button, Dialog } from 'primevue';
import { ref } from 'vue';

import ImproveDescription from './components/ImproveDescription.vue';
import SpecGuideDialog from './components/SpecGuideDialog.vue';

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
const isSpecGuideOpened = ref(false);
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
    modal
    :style="{ width: '760px' }"
  >
    <template #header>
      <div class="flex items-center gap-1">
        <span class="p-dialog-title">Улучшение описания задачи</span>
        <Button
          v-tooltip="'Как написать хорошее ТЗ'"
          size="small"
          severity="secondary"
          icon="pi pi-info-circle"
          variant="text"
          @click="isSpecGuideOpened = true"
        />
      </div>
    </template>
    <ImproveDescription
      :session-id
      :task-id
    />
  </Dialog>

  <SpecGuideDialog v-model:visible="isSpecGuideOpened" />
</template>
