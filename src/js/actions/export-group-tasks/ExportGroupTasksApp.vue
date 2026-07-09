<script setup>
import { Dialog } from 'primevue';
import { ref } from 'vue';

import PtsToast from '../../ui/PtsToast.vue';
import ExportGroupTasks from './components/ExportGroupTasks.vue';

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
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round --with-left-icon --with-collapsed-icon pts-btn-export-group-tasks"
    type="button"
    title="Экспорт задач группы"
    @click="modalOpened = true"
  >
    Экспорт
  </button>

  <Dialog
    v-model:visible="modalOpened"
    header="Экспорт задач группы"
    dismissable-mask
    modal
    style="width: 1100px; max-width: 95vw;"
  >
    <ExportGroupTasks
      :session-id
      :group-id
    />
  </Dialog>

  <PtsToast group="export-group-tasks" />
</template>
