<script setup>
import {Button, Dialog, Message, Select} from 'primevue';
import { computed, onMounted, ref } from 'vue';

import BitrixApi from '../../BitrixApi.js';
import { usePersonalGroupFilter } from '../../composables/usePersonalGroupFilter.js';
import FormField from '../../ui/FormField.vue';
import ScrumPoints from './components/ScrumPoints.vue';

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

// У «Моего плана» нет своего канбана, а таблица баллов держится на его колонках, поэтому на личном
// плане виджет работает по выбранной группе. Настройки при этом общие с виджетом самой группы
const { groupOptions, selectedGroupId, restoreGroupFilter } = usePersonalGroupFilter(
  new BitrixApi(props.sessionId),
  `scrum-points-personal-group-${props.context.id}`,
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
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round --with-left-icon --with-collapsed-icon pts-btn-scrum-points"
    type="button"
    title="Scrum-баллы"
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
        <span class="p-dialog-title">Баллы за спринт</span>
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
        tip="У личного плана нет своего канбана, поэтому баллы считаются по колонкам выбранной группы"
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
      Выберите группу — баллы считаются по колонкам её канбана.
    </Message>

    <ScrumPoints
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
      <p>Для правильной работы виджета задачи должны именоваться по шаблону: <i>«Название задачи | Баллы»</i>, например: <i>«General | F | Вёрстка лендинга | 13»</i>.</p>
      <p>Число разделов, отделённых символом <i>«|»</i>, может быть любым — главное, чтобы в конце стояло число с баллами.</p>
      <p>Если в вашей команде используется другой формат названий задач, создайте Pull Request и добавьте опцию переключения логики в настройках виджета.</p>
    </div>
  </Dialog>
</template>

