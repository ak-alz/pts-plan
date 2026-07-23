<script setup>
import {Button, Dialog} from 'primevue';
import { ref } from 'vue';

import ScrumSummary from './components/ScrumSummary.vue';

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

const isInfoModalOpened = ref(false);
</script>

<template>
  <button
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round --with-left-icon --with-collapsed-icon pts-btn-scrum-summary"
    type="button"
    title="Scrum-сводка"
    @click="modalOpened = true"
  >
    Scrum-сводка
  </button>

  <Dialog
    v-model:visible="modalOpened"
    dismissable-mask
    modal
  >
    <template #header>
      <div class="flex items-center gap-1">
        <span class="p-dialog-title">Сводка по спринтам</span>
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

    <ScrumSummary
      :session-id
      :group-id
    />
  </Dialog>

  <Dialog
    v-model:visible="isInfoModalOpened"
    header="Как это работает"
    dismissable-mask
    modal
  >
    <div class="w-[350px]">
      <p>Все итоги спринтов должны размещаться в комментариях к одной и той же задаче.</p>
      <p>Для корректной работы виджета структура комментария с итогами спринта должна быть следующей:</p>

      <div class="bg-surface-100 border border-surface-200 rounded-lg p-3">
        <p class="mt-0">
          Итог 327 спринта
        </p>
        <p>55 баллов</p>
        <ul class="mb-0 pl-5">
          <li><a href="/company/personal/user/1">Иван Иванов</a> — 21 балл</li>
          <li><a href="/company/personal/user/2">Петр Петров</a> — 34 балла</li>
        </ul>
      </div>

      <p>Если в вашей команде используется другой формат подведения итогов спринтов, создайте Pull Request и добавьте опцию переключения логики в настройках виджета.</p>
    </div>
  </Dialog>
</template>

