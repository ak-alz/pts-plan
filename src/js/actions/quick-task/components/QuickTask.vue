<script setup>
import {Avatar, Badge, Button, Checkbox, Dialog, InputText, MultiSelect, Select, Textarea} from 'primevue';
import {useToast} from 'primevue/usetoast';
import {onMounted, reactive, ref} from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import FormField from '../../../ui/FormField.vue';
import {getCommitMessage, getTaskUrl} from '../../../utils.js';
import QuickTaskSettings from './QuickTaskSettings.vue';

const props = defineProps({
  sessionId: {type: String, required: true},
  groupId: {type: String, required: true},
  stageId: {type: String, default: null},
});

const emit = defineEmits(['success']);

const api = new BitrixApi(props.sessionId);
const toast = useToast();
const settingsStorageKey = `quick-task-settings-${props.groupId}`;

const isSettingsOpen = ref(false);
const isLoadingData = ref(false);
const isSubmitting = ref(false);

const userId = ref(null);
const users = ref([]);
const stages = ref([]);
const settings = ref({});

const form = reactive({
  title: '',
  description: '',
  stageId: props.stageId,
  responsibleId: null,
  auditorIds: [],
  copyCommit: false,
});

async function loadSettings() {
  try {
    const res = await chrome.storage.local.get([settingsStorageKey]);
    settings.value = res[settingsStorageKey] ?? {};
  } catch { /* ignore */ }
}

function applyDefaults() {
  form.copyCommit = !!(settings.value.showCommitCheckbox && settings.value.copyCommitDefault);
  form.responsibleId = settings.value.defaultResponsible ?? userId.value;
  form.auditorIds = settings.value.defaultAuditors ?? [];
}

async function onSettingsSaved() {
  await loadSettings();
  isSettingsOpen.value = false;
}

onMounted(async () => {
  isLoadingData.value = true;
  try {
    const [groupUsers, stagesResp, currentUser] = await Promise.all([
      api.getGroupUsers(props.groupId),
      api.getStages(props.groupId),
      api.getCurrentUser(),
    ]);
    await loadSettings();

    userId.value = currentUser ? Number(currentUser.ID) : null;
    users.value = groupUsers.map((u) => ({
      id: Number(u.ID),
      title: [u.NAME, u.LAST_NAME].filter(Boolean).join(' '),
      avatar: u.PERSONAL_PHOTO ?? '',
    }));
    stages.value = Object.values(stagesResp.data?.result ?? {})
      .sort((a, b) => a.SORT - b.SORT)
      .map((s) => ({id: s.ID, title: s.TITLE, color: `#${s.COLOR}`}));

    applyDefaults();
  } catch { /* ignore */ } finally {
    isLoadingData.value = false;
  }
});

async function submit() {
  const title = form.title.trim();
  if (!title) return;
  isSubmitting.value = true;
  try {
    const fields = {TITLE: title, GROUP_ID: props.groupId};
    if (form.stageId) fields.STAGE_ID = form.stageId;
    if (form.responsibleId) fields.RESPONSIBLE_ID = form.responsibleId;
    if (form.description.trim()) fields.DESCRIPTION = form.description.trim();
    if (form.auditorIds.length) fields.AUDITORS = form.auditorIds;

    const {data} = await api.addTask(fields);
    const taskId = String(data?.result?.task?.id ?? data?.result?.task?.ID ?? '');

    if (form.copyCommit && taskId) {
      const commitMsg = getCommitMessage(title, taskId);
      try {
        await navigator.clipboard.writeText(commitMsg);
        toast.add({severity: 'info', summary: 'Текст коммита скопирован', detail: commitMsg, life: 5000});
      } catch { /* ignore */ }
    }

    const taskUrl = taskId && settings.value.showCreatedTask ? getTaskUrl(props.groupId, taskId) : null;
    toast.add({
      severity: 'success',
      summary: 'Задача создана',
      taskUrl,
      taskTitle: title,
      life: taskUrl ? 8000 : 3000,
    });
    emit('success');
  } catch {
    toast.add({severity: 'error', summary: 'Ошибка создания задачи', life: 3000});
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 pt-1">
    <div class="mb-3">
      <Button
        icon="pi pi-cog"
        label="Настройки"
        size="small"
        severity="secondary"
        text
        @click="isSettingsOpen = true"
      />
    </div>

    <div class="grid grid-cols-3 gap-3">
      <FormField label="Стадия">
        <Select
          v-model="form.stageId"
          option-value="id"
          option-label="title"
          :options="stages"
          :loading="isLoadingData"
          show-clear
          fluid
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

      <FormField label="Исполнитель">
        <Select
          v-model="form.responsibleId"
          option-value="id"
          option-label="title"
          :options="users"
          :loading="isLoadingData"
          filter
          filter-placeholder="Поиск"
          show-clear
          fluid
          placeholder="Выбрать"
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
        </Select>
      </FormField>

      <FormField label="Наблюдатели">
        <MultiSelect
          v-model="form.auditorIds"
          option-value="id"
          option-label="title"
          :options="users"
          :loading="isLoadingData"
          filter
          filter-placeholder="Поиск"
          :max-selected-labels="2"
          fluid
          placeholder="Выбрать"
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
    </div>

    <FormField label="Название">
      <InputText
        v-model="form.title"
        placeholder="Название задачи"
        autofocus
        fluid
        @keydown.enter.prevent="submit"
      />
    </FormField>

    <FormField label="Описание">
      <Textarea
        v-model="form.description"
        rows="3"
        fluid
        placeholder="Описание задачи (необязательно)"
      />
    </FormField>

    <div
      v-if="settings.showCommitCheckbox"
      class="flex gap-2 items-center"
    >
      <Checkbox
        v-model="form.copyCommit"
        binary
        input-id="qt-copy-commit"
      />
      <label
        for="qt-copy-commit"
        class="text-sm cursor-pointer select-none"
      >Копировать текст коммита</label>
      <i
        v-tooltip.top="'После создания задачи текст коммита будет скопирован в буфер обмена'"
        class="pi pi-question-circle"
      />
    </div>

    <div class="flex">
      <Button
        label="Создать"
        :loading="isSubmitting"
        :disabled="!form.title.trim()"
        @click="submit"
      />
    </div>
  </div>

  <Dialog
    v-model:visible="isSettingsOpen"
    header="Настройки быстрой задачи"
    modal
    dismissable-mask
  >
    <QuickTaskSettings
      :initial="settings"
      :settings-storage-key="settingsStorageKey"
      :users="users"
      :current-user-id="userId"
      @success="onSettingsSaved"
    />
  </Dialog>
</template>
