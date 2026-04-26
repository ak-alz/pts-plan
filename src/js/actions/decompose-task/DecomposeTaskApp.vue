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
    type: Number,
    required: true,
  },
  responsiveId: {
    type: Number,
    required: true,
  },
  taskTitle: {
    type: String,
    default: '',
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
      :responsive-id
      :task-title
      :task-id
      @success="modalOpened = false"
    />
  </Dialog>

  <Toast position="bottom-right">
    <template #message="{ message }">
      <div class="flex flex-col gap-2 flex-1">
        <span class="p-toast-summary">{{ message.summary }}</span>
        <div
          v-if="message.detail"
          class="p-toast-detail"
        >
          {{ message.detail }}
        </div>
        <ul
          v-if="message.tasks?.length"
          class="m-0 pl-4 flex flex-col gap-1"
        >
          <li
            v-for="task in message.tasks"
            :key="task.id"
          >
            <a
              :href="task.url"
              target="_blank"
              rel="noopener"
            >{{ task.title }}</a>
          </li>
        </ul>
      </div>
    </template>
  </Toast>
</template>
