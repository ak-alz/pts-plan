<script setup>
import { Dialog, Message, Select } from 'primevue';
import { computed, onMounted, ref } from 'vue';

import BitrixApi from '../../BitrixApi.js';
import { usePersonalGroupFilter } from '../../composables/usePersonalGroupFilter.js';
import FormField from '../../ui/FormField.vue';
import SprintPriorities from './components/SprintPriorities.vue';

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
  `sprint-priorities-personal-group-${props.context.id}`,
);
const activeGroupId = computed(() => (isPersonal.value ? selectedGroupId.value : props.context.id));

onMounted(() => {
  if (isPersonal.value) restoreGroupFilter();
});

const modalOpened = ref(false);
</script>

<template>
  <button
    class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round --with-left-icon --with-collapsed-icon pts-btn-sprint-priorities"
    type="button"
    title="Приоритеты спринта"
    @click="modalOpened = true"
  >
    Приоритеты
  </button>

  <Dialog
    v-model:visible="modalOpened"
    header="Приоритеты спринта"
    dismissable-mask
    modal
    :style="{ maxWidth: '95vw' }"
  >
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

    <SprintPriorities
      v-if="activeGroupId"
      :key="activeGroupId"
      :session-id
      :group-id="activeGroupId"
    />
  </Dialog>
</template>
