<script setup>
import { Button, Dialog } from 'primevue';
import { computed, ref } from 'vue';

import PersonalScopeWarning from '../../ui/PersonalScopeWarning.vue';
import TaskAnalysis from './components/TaskAnalysis.vue';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  context: {
    type: Object,
    required: true,
  },
  options: {
    type: Object,
    default: () => ({}),
  },
});

const isPersonal = computed(() => props.context.type === 'personal');
const modalOpened = ref(false);
const isInfoModalOpened = ref(false);
</script>

<template>
  <button
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round --with-left-icon --with-collapsed-icon pts-btn-task-analysis"
    type="button"
    title="Анализ задач"
    @click="modalOpened = true"
  >
    Анализ
  </button>

  <Dialog
    v-model:visible="modalOpened"
    dismissable-mask
    modal
  >
    <template #header>
      <div class="flex items-center gap-1">
        <span class="p-dialog-title">Анализ задач</span>
        <PersonalScopeWarning
          v-if="isPersonal"
          with-performer-note
        />
        <Button
          v-tooltip="'Как это работает'"
          size="small"
          severity="secondary"
          icon="pi pi-info-circle"
          variant="text"
          @click="isInfoModalOpened = true"
        />
      </div>
    </template>
    <TaskAnalysis
      :session-id
      :context
      :options
    />
  </Dialog>

  <Dialog
    v-model:visible="isInfoModalOpened"
    header="Как это работает"
    dismissable-mask
    modal
  >
    <div class="w-[350px]">
      <p>Виджет загружает дочерние задачи выбранных исполнителей за указанный период, суммирует их баллы и группирует по корневой родительской задаче.</p>
      <p>Баллы извлекаются из названия задачи по шаблону <i>«Название | Баллы»</i>, например: <i>«General | F | Вёрстка лендинга | 13»</i>. Число разделов, отделённых символом <i>«|»</i>, может быть любым — главное, чтобы в конце стояло число с баллами. Задачи без баллов не учитываются.</p>
      <p>Если в вашей команде используется другой формат названий задач, создайте Pull Request и добавьте опцию переключения логики в настройках виджета.</p>
    </div>
  </Dialog>
</template>
