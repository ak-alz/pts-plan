<script setup>
import { Dialog } from 'primevue';
import { computed, ref } from 'vue';

import PersonalScopeWarning from '../../ui/PersonalScopeWarning.vue';
import SprintHistoryMain from './components/SprintHistory.vue';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  context: {
    type: Object,
    required: true,
  },
});

const isPersonal = computed(() => props.context.type === 'personal');
const modalOpened = ref(false);
</script>

<template>
  <button
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round --with-left-icon --with-collapsed-icon pts-btn-sprint-history"
    type="button"
    title="История спринтов"
    @click="modalOpened = true"
  >
    История
  </button>

  <Dialog
    v-model:visible="modalOpened"
    dismissable-mask
    modal
  >
    <template #header>
      <div class="flex items-center gap-2">
        <span class="p-dialog-title">История спринта</span>
        <PersonalScopeWarning
          v-if="isPersonal"
          with-performer-note
        />
      </div>
    </template>
    <SprintHistoryMain
      :session-id
      :context
    />
  </Dialog>
</template>
