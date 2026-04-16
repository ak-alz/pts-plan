<script setup>
import { Dialog, Toast } from 'primevue';
import { ref } from 'vue';

import TaskSearchMain from './components/TaskSearch.vue';

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
    Поиск
  </button>

  <Dialog
    v-model:visible="modalOpened"
    header="Поиск по задачам"
    dismissable-mask
    modal
    style="width: 900px; max-width: 95vw;"
  >
    <TaskSearchMain
      :session-id
      :group-id
    />
  </Dialog>

  <Toast position="bottom-right" />
</template>
