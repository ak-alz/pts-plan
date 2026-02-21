<script setup>
import {Dialog, Toast} from 'primevue';
import {ref} from 'vue';

import DecomposeTask from './components/DecomposeTask.vue';

defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  taskTitle: {
    type: String,
    default: '',
  },
  groupId: {
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
    class="decompose-task-button"
    type="button"
    title="Декомпозировать задачу"
    @click="modalOpened = true"
  >
    <i class="pi pi-sitemap" />
  </button>

  <Dialog
    v-model:visible="modalOpened"
    header="Декомпозиция задачи"
    modal
  >
    <DecomposeTask
      :session-id
      :user-id
      :task-title
      :group-id
      :task-id
      @success="modalOpened = false"
    />
  </Dialog>

  <Toast position="bottom-right" />
</template>
