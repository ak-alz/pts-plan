<script setup>
import {Dialog} from 'primevue';
import {ref} from 'vue';

import DecomposeTask from './components/DecomposeTask.vue';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  readPageTask: {
    type: Function,
    required: true,
  },
  taskId: {
    type: String,
    required: true,
  },
});

const modalOpened = ref(false);
const taskTitle = ref('');
const responsibleId = ref(0);

function openModal() {
  const pageTask = props.readPageTask();
  taskTitle.value = pageTask.title;
  responsibleId.value = pageTask.responsibleId;
  modalOpened.value = true;
}
</script>

<template>
  <button
    class="decompose-task-button"
    type="button"
    title="Декомпозировать задачу"
    @click="openModal"
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
      :responsible-id
      :task-title
      :task-id
      @success="modalOpened = false"
    />
  </Dialog>
</template>
