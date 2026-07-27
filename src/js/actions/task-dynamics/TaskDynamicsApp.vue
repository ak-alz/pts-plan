<script setup>
import {Button, Dialog} from 'primevue';
import {ref} from 'vue';

import TaskDynamics from './components/TaskDynamics.vue';

defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
  options: {
    type: Object,
    default: () => ({}),
  },
});

const modalOpened = ref(false);
const isInfoModalOpened = ref(false);
</script>

<template>
  <button
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round --with-left-icon --with-collapsed-icon pts-btn-task-dynamics"
    type="button"
    title="Динамика задач группы"
    @click="modalOpened = true"
  >
    Динамика
  </button>

  <!-- Ширину окна задаём явно: графики Chart.js тянутся по ширине контейнера, а окно без ограничения
       растягивается по содержимому — на широком мониторе оно расползалось на весь экран -->
  <Dialog
    v-model:visible="modalOpened"
    dismissable-mask
    modal
    :style="{width: '1400px', maxWidth: '95vw'}"
    :pt="{content: {class: 'overflow-x-auto'}}"
  >
    <template #header>
      <div class="flex items-center gap-1">
        <span class="p-dialog-title">Динамика задач группы</span>
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
    <TaskDynamics
      v-if="modalOpened"
      :session-id
      :group-id
      :options
    />
  </Dialog>

  <Dialog
    v-model:visible="isInfoModalOpened"
    header="Как это работает"
    dismissable-mask
    modal
  >
    <div class="w-[420px] flex flex-col gap-2 text-sm">
      <p>Виджет смотрит на процесс группы в целом: входящий поток задач, планы, качество, декомпозицию и рост команды по месяцам. Это не отчёт по людям — для него есть «Анализ баллов задач».</p>
      <p>Все цифры считаются на клиенте по задачам группы: у каждой метрики своя дата — создание по дате создания, закрытия, баллы и время по дате закрытия, сколько задача ждёт в планах — срезом на сейчас.</p>
      <p>Главное, что стоит помнить: доступно только полное время от постановки до закрытия. Внутри него сидит ожидание в планах, поэтому это «сколько задача ждала», а не «как быстро работает команда».</p>
      <p>Загруженные дни сохраняются, поэтому повторное открытие за тот же период почти не делает запросов. Кнопка «Обновить» перезагружает всё заново — она нужна, если задачи возвращали в работу и закрывали снова. Сохраняются только итоги по дням, сами задачи нигде не хранятся, а история старше четырёх лет удаляется сама.</p>
      <p>Колонки с планами и архивные колонки размечаются в настройках виджета: без разметки нельзя отличить живую очередь от свалки, где задачи лежат годами.</p>
    </div>
  </Dialog>
</template>
