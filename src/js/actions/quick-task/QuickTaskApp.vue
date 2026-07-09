<script setup>
import {Dialog} from 'primevue';
import {onMounted, onUnmounted, ref} from 'vue';

import PtsToast from '../../ui/PtsToast.vue';
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

  <PtsToast group="quick-task" />
</template>
