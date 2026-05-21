<script setup>
import {Dialog, Toast} from 'primevue';
import {onMounted, onUnmounted, ref} from 'vue';

import QuickTask from './components/QuickTask.vue';

defineProps({
  sessionId: {type: String, required: true},
  groupId: {type: String, required: true},
});

const isOpen = ref(false);
const stageId = ref(null);

function handleOpenEvent(e) {
  stageId.value = e.detail.stageId ?? null;
  isOpen.value = true;
}

onMounted(() => document.addEventListener('pts:quick-task:open', handleOpenEvent));
onUnmounted(() => document.removeEventListener('pts:quick-task:open', handleOpenEvent));
</script>

<template>
  <Dialog
    v-model:visible="isOpen"
    header="Быстрая задача"
    modal
    dismissable-mask
    :style="{ width: '800px' }"
  >
    <QuickTask
      v-if="isOpen"
      :session-id
      :group-id
      :stage-id
      @success="isOpen = false"
    />
  </Dialog>

  <Toast position="bottom-right">
    <template #message="{ message }">
      <div class="flex flex-col gap-1 flex-1">
        <span class="p-toast-summary">{{ message.summary }}</span>
        <div
          v-if="message.detail"
          class="p-toast-detail"
        >
          {{ message.detail }}
        </div>
        <a
          v-if="message.taskUrl"
          :href="message.taskUrl"
          target="_blank"
          rel="noopener"
          class="p-toast-detail underline"
        >{{ message.taskTitle }}</a>
      </div>
    </template>
  </Toast>
</template>
