<script setup>
import { Avatar, Badge, Button, MultiSelect, Select, Skeleton } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import FormField from '../../../ui/FormField.vue';
import { getTaskUrl } from '../../../utils.js';
import { buildSprintComment, buildTaskDescription, TASK_TITLE } from '../taskTemplate.js';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
  settingsStorageKey: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['success']);

const toast = useToast();
const bitrixApi = new BitrixApi(props.sessionId);

const isLoading = ref(true);
const isSubmitting = ref(false);
const stages = ref([]);
const groupUsers = ref([]);
const currentUser = ref(null);
const sprintComment = ref('');

const form = reactive({
  stageId: null,
  auditors: [],
});

onMounted(async () => {
  try {
    const [stagesResponse, users, user] = await Promise.all([
      bitrixApi.getStages(props.groupId),
      bitrixApi.getGroupUsers(props.groupId),
      bitrixApi.getCurrentUser(),
    ]);
    stages.value = Object.values(stagesResponse.data?.result ?? {})
      .sort((a, b) => a.SORT - b.SORT)
      .map((s) => ({ id: s.ID, title: s.TITLE, color: `#${s.COLOR}` }));
    groupUsers.value = users.map((u) => ({
      id: Number(u.ID),
      title: [u.NAME, u.LAST_NAME].filter(Boolean).join(' '),
      avatar: u.PERSONAL_PHOTO ?? '',
    }));
    currentUser.value = user;

    const commentUsers = groupUsers.value.length > 0
      ? groupUsers.value
      : [{ id: Number(user.ID), title: [user.NAME, user.LAST_NAME].filter(Boolean).join(' ') }];
    sprintComment.value = buildSprintComment(commentUsers);
  } catch (e) {
    toast.add({
      group: 'scrum-summary',
      severity: 'error',
      summary: 'Ошибка загрузки',
      detail: e.message,
      life: 5000,
    });
  } finally {
    isLoading.value = false;
  }
});

async function createTask() {
  if (!currentUser.value) return;
  isSubmitting.value = true;
  try {
    const auditorIds = form.auditors.length ? form.auditors : [Number(currentUser.value.ID)];

    const taskResponse = await bitrixApi.addTask({
      TITLE: TASK_TITLE,
      DESCRIPTION: buildTaskDescription(sprintComment.value, groupUsers.value),
      GROUP_ID: props.groupId,
      STAGE_ID: form.stageId,
      RESPONSIBLE_ID: currentUser.value.ID,
      AUDITORS: auditorIds,
    });

    const taskId = taskResponse.data?.result?.task?.id;
    if (!taskId) throw new Error('Не удалось получить ID созданной задачи');

    await bitrixApi.addComment(taskId, sprintComment.value).catch(() => {});

    // Ключ должен совпадать с settingsStorageKey в scrum-points/components/ScrumPoints.vue
    const scrumPointsKey = `scrum-points-settings-${props.groupId}`;
    const stored = await chrome.storage.local.get([props.settingsStorageKey, scrumPointsKey]);
    const existing = stored[props.settingsStorageKey] ?? {};
    const existingScrumPoints = stored[scrumPointsKey] ?? {};
    await chrome.storage.local.set({
      [props.settingsStorageKey]: { ...existing, taskId: Number(taskId) },
      [scrumPointsKey]: { ...existingScrumPoints, summaryTaskId: Number(taskId) },
    });

    toast.add({
      group: 'scrum-summary',
      severity: 'success',
      summary: 'Задача создана',
      taskUrl: getTaskUrl(props.groupId, taskId),
      taskTitle: TASK_TITLE,
      life: 8000,
    });

    emit('success');
  } catch (e) {
    toast.add({
      group: 'scrum-summary',
      severity: 'error',
      summary: 'Ошибка',
      detail: e.message,
      life: 5000,
    });
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="w-[400px]">
    <div class="text-sm text-surface-500 mb-4">
      Хотите начать вести учёт спринтов в задаче? Будет создана задача с описанием формата Scrum-отчётов и шаблонным комментарием с примером итогов спринта.
    </div>

    <div
      v-if="isLoading"
      class="flex flex-col gap-3"
    >
      <Skeleton height="2.25rem" />
      <Skeleton height="2.25rem" />
      <Skeleton height="2.25rem" />
    </div>

    <div
      v-else
      class="flex flex-col gap-3"
    >
      <FormField
        id="create_task_stage"
        label="Стадия"
      >
        <Select
          v-model="form.stageId"
          :options="stages"
          option-value="id"
          option-label="title"
          fluid
          input-id="create_task_stage"
          placeholder="Выбрать"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Badge :style="`background-color: ${option.color};`" />
              {{ option.title }}
            </div>
          </template>
        </Select>
      </FormField>

      <FormField
        id="create_task_auditors"
        label="Наблюдатели"
        tip="Если не выбрать — наблюдателем станет текущий пользователь"
      >
        <MultiSelect
          v-model="form.auditors"
          :options="groupUsers"
          option-value="id"
          option-label="title"
          filter
          filter-placeholder="Поиск"
          fluid
          input-id="create_task_auditors"
          :max-selected-labels="3"
          placeholder="Текущий пользователь"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.avatar"
                :image="option.avatar"
                shape="circle"
                size="small"
              />
              {{ option.title }}
            </div>
          </template>
        </MultiSelect>
      </FormField>

      <Button
        label="Создать"
        size="small"
        :loading="isSubmitting"
        :disabled="!form.stageId"
        @click="createTask"
      />
    </div>
  </div>
</template>
