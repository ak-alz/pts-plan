<script setup>
import { Dialog } from 'primevue';
import { computed, ref } from 'vue';

import PersonalScopeWarning from '../../ui/PersonalScopeWarning.vue';
import ExportGroupTasks from './components/ExportGroupTasks.vue';

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
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round --with-left-icon --with-collapsed-icon pts-btn-export-group-tasks"
    type="button"
    title="Экспорт задач группы"
    @click="modalOpened = true"
  >
    Экспорт
  </button>

  <Dialog
    v-model:visible="modalOpened"
    dismissable-mask
    modal
    style="width: 1100px; max-width: 95vw;"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <span class="p-dialog-title">Экспорт задач группы</span>
        <PersonalScopeWarning v-if="isPersonal" />
      </div>
    </template>
    <ExportGroupTasks
      :session-id
      :context
    />
  </Dialog>
</template>
