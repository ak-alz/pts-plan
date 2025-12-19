<script setup>
import {Button, Dialog, Toast} from 'primevue';
import { ref } from 'vue';

import ScrumPoints from './components/ScrumPoints.vue';

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
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round"
    type="button"
    @click="modalOpened = true"
  >
    Scrum
  </button>

  <Dialog
    v-model:visible="modalOpened"
    dismissable-mask
    modal
  >
    <template #header>
      <div class="flex items-center gap-1">
        <span class="p-dialog-title">Спринт</span>
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
    <ScrumPoints
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
    <div style="width: 350px;">
      <p>Для правильной работы виджета задачи должны именоваться по шаблону: <i>«Название задачи | Баллы»</i>, например: <i>«General | F | Вёрстка лендинга | 13»</i>.</p>
      <p>Число разделов, отделённых символом <i>«|»</i>, может быть любым — главное, чтобы в конце стояло число с баллами.</p>
      <p>Если в вашей команде используется другой формат названий задач, создайте Pull Request и добавьте опцию переключения логики в настройках виджета.</p>
    </div>
  </Dialog>

  <Toast position="bottom-right" />
</template>

<style scoped>

</style>
