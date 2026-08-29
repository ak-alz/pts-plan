<script setup>
import { Button, Dialog, Message, Select } from 'primevue';
import { computed, onMounted, ref } from 'vue';

import BitrixApi from '../../BitrixApi.js';
import { usePersonalGroupFilter } from '../../composables/usePersonalGroupFilter.js';
import FormField from '../../ui/FormField.vue';
import ScrumSummary from './components/ScrumSummary.vue';

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

// У «Моего плана» нет ни своего канбана, ни спринтов, поэтому на личном плане виджет работает по
// выбранной группе — по образцу scrum-points. Настройки при этом общие с виджетом самой группы
const { groupOptions, selectedGroupId, restoreGroupFilter } = usePersonalGroupFilter(
  new BitrixApi(props.sessionId),
  `scrum-summary-personal-group-${props.context.id}`,
);
const activeGroupId = computed(() => (isPersonal.value ? selectedGroupId.value : props.context.id));

onMounted(() => {
  if (isPersonal.value) restoreGroupFilter();
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

    <div
      v-if="isPersonal"
      class="mb-3"
    >
      <FormField
        label="Группа"
        tip="У личного плана нет своего канбана и спринтов, поэтому виджет работает по выбранной группе"
      >
        <Select
          v-model="selectedGroupId"
          :options="groupOptions"
          option-label="name"
          option-value="id"
          placeholder="Выберите группу"
          filter
          filter-placeholder="Поиск"
          size="small"
          class="min-w-[260px]"
        />
      </FormField>
    </div>

    <Message
      v-if="isPersonal && !activeGroupId"
      severity="info"
      size="small"
      :closable="false"
    >
      Выберите группу — виджет считает по её спринтам и колонкам.
    </Message>

    <ScrumSummary
      v-if="activeGroupId"
      :key="activeGroupId"
      :session-id
      :group-id="activeGroupId"
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

      <div class="bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg p-3">
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

