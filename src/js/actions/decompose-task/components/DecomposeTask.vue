<script setup>
import { Avatar, Badge, Button, Checkbox, Column, DataTable, Dialog, MultiSelect, Select, Textarea } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { getCommitMessage, getTaskUrl } from '../../../utils.js';
import SettingsForm from './SettingsForm.vue';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  userId: {
    type: Number,
    required: true,
  },
  responsiveId: {
    type: Number,
    required: true,
  },
  taskTitle: {
    type: String,
    default: '',
  },
  taskId: {
    type: String,
    required: true,
  },
});

const emits = defineEmits(['success']);

async function resolveGroupId(url, sessionId, taskId) {
  if (!url.includes('/company/personal/user/')) {
    const match = url.match(/\/(\d+)\/tasks\/task\/view\/\d+/);
    if (match?.[1]) return match[1];
  }
  const api = new BitrixApi(sessionId);
  const { data } = await api.getTask(taskId, ['GROUP_ID']);
  const id = String(data?.result?.task?.groupId ?? '');
  return id && id !== '0' ? id : null;
}

const toast = useToast();
const bitrixApi = new BitrixApi(props.sessionId);

const groupId = ref('');

const users = ref([]);
const stages = ref([]);
const isLoading = ref(false);
const progress = ref(null);

const settings = ref({});
const settingsStorageKey = computed(() => `decompose-task-settings-${groupId.value}`);
const isSettingsModalOpened = ref(false);
const parentAuditorIds = ref([]);
const defaultAuditors = computed(() => settings.value.defaultAuditors ?? 'inherit');

let rowIdCounter = 0;

function onCopyContentChange(row) {
  if (row.copyContent) row.description = '';
}

function onCopyCommitChange(row) {
  if (!row.copyCommit) return;
  rows.value.forEach((other) => {
    if (other._id !== row._id) other.copyCommit = false;
  });
}

function createRow() {
  return {
    _id: rowIdCounter++,
    title: props.taskTitle,
    description: '',
    copyContent: settings.value.copyContentDefault ?? false,
    copyCommit: rows.value.length === 0 && (settings.value.copyCommitDefault ?? false),
    responsibleId: !settings.value.defaultResponsible || settings.value.defaultResponsible === 'inherit' ? props.responsiveId : props.userId,
    stageId: settings.value.defaultStageId ?? null,
    auditorIds: defaultAuditors.value === 'all'
      ? users.value.map((u) => u.id)
      : defaultAuditors.value === 'inherit'
        ? [...parentAuditorIds.value]
        : [props.userId],
  };
}

const rows = ref([]);

function addRow() {
  rows.value.push(createRow());
}

function removeRow(index) {
  rows.value.splice(index, 1);
}

async function loadSettings() {
  const res = await chrome.storage.local.get([settingsStorageKey.value]);
  if (res[settingsStorageKey.value]) {
    settings.value = res[settingsStorageKey.value];
  }
}

async function onSaveSettings() {
  await loadSettings();
  isSettingsModalOpened.value = false;
}

async function submit() {
  progress.value = null;
  isLoading.value = true;
  const total = rows.value.length;

  try {
    progress.value = 0;

    let parentDescription = '';
    if (rows.value.some((r) => r.copyContent)) {
      const { data } = await bitrixApi.getTask(props.taskId, ['DESCRIPTION']);
      parentDescription = data?.result?.task?.description ?? '';
    }

    const responses = await bitrixApi.addTasksBatch(rows.value.map((row) => ({
      TITLE: row.title,
      DESCRIPTION: row.copyContent ? parentDescription : row.description,
      CREATED_BY: props.userId,
      RESPONSIBLE_ID: row.responsibleId,
      AUDITORS: row.auditorIds,
      GROUP_ID: groupId.value,
      PARENT_ID: props.taskId,
      STAGE_ID: row.stageId || 0,
    })));
    progress.value = 100;

    const createdIds = new Array(rows.value.length).fill(null);
    responses.forEach((response) => {
      const results = response.data?.result?.result ?? {};
      Object.entries(results).forEach(([key, value]) => {
        const index = parseInt(key.slice(1), 10);
        if (Number.isInteger(index)) {
          const id = value?.task?.id ?? value?.task?.ID ?? null;
          createdIds[index] = id ? String(id) : null;
        }
      });
    });

    const createdTasks = rows.value
      .map((row, i) => createdIds[i] ? { id: createdIds[i], title: row.title, url: getTaskUrl(groupId.value, createdIds[i]) } : null)
      .filter(Boolean);

    const commitRowIndex = rows.value.findIndex((r) => r.copyCommit);
    if (commitRowIndex !== -1 && createdIds[commitRowIndex]) {
      const commitRow = rows.value[commitRowIndex];
      const commitId = createdIds[commitRowIndex];
      const commitMessage = getCommitMessage(commitRow.title, commitId);
      try {
        await navigator.clipboard.writeText(commitMessage);
        toast.add({
          severity: 'info',
          summary: 'Текст коммита скопирован',
          detail: commitMessage,
          life: 5000,
        });
      } catch (e) {
        console.warn(e);
      }
    }

    const showTasks = settings.value.showCreatedTasks && createdTasks.length > 0;
    toast.add({
      severity: 'success',
      summary: 'Готово',
      detail: `[pts-plan]: Создано подзадач: ${total}`,
      tasks: showTasks ? createdTasks : undefined,
      life: showTasks ? 15000 : 5000,
    });

    emits('success');
  } catch (e) {
    console.warn(e);
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: `[pts-plan]: ${e.message}`,
      life: 5000,
    });
  } finally {
    isLoading.value = false;
  }
}

async function fetchData() {
  isLoading.value = true;

  try {
    const resolved = await resolveGroupId(window.location.href, props.sessionId, props.taskId);
    if (!resolved) throw new Error('Не удалось определить группу задачи');
    groupId.value = resolved;

    await loadSettings();
    const [groupUsers, stagesResponse] = await Promise.all([
      bitrixApi.getGroupUsers(groupId.value),
      bitrixApi.getStages(groupId.value),
    ]);

    if (defaultAuditors.value === 'inherit') {
      const { data } = await bitrixApi.getTask(props.taskId, ['AUDITORS']);
      parentAuditorIds.value = (data?.result?.task?.auditors ?? []).map(Number);
    }

    users.value = groupUsers.map((u) => ({
      id: Number(u.ID),
      title: [u.NAME, u.LAST_NAME].filter(Boolean).join(' '),
      avatar: u.PERSONAL_PHOTO ?? '',
    }));
    stages.value = Object.values(stagesResponse.data?.result ?? {})
      .sort((a, b) => a.SORT - b.SORT)
      .map((s) => ({ id: s.ID, title: s.TITLE, color: `#${s.COLOR}` }));
    addRow();
  } catch (e) {
    console.warn(e);
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: `[pts-plan]: ${e.message}`,
      life: 5000,
    });
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <form @submit.prevent="submit">
    <DataTable
      :value="rows"
      :loading="isLoading"
      data-key="_id"
      size="small"
      striped-rows
    >
      <template #loading>
        <template v-if="typeof progress === 'number'">
          {{ progress }}%
        </template>
        <template v-else>
          Загрузка...
        </template>
      </template>

      <template #header>
        <Button
          icon="pi pi-cog"
          label="Настройки"
          size="small"
          severity="secondary"
          variant="text"
          :disabled="isLoading"
          @click="isSettingsModalOpened = true"
        />
      </template>

      <Column header="Название">
        <template #body="{ data: row }">
          <div class="flex flex-col gap-1">
            <Textarea
              v-model="row.title"
              fluid
              rows="2"
              cols="40"
              :pt="{
                root: {
                  style: {
                    minHeight: '35px',
                    resize: 'vertical',
                    display: 'block',
                  }
                }
              }"
            />
            <div
              v-if="settings.showCommitCheckbox"
              class="flex gap-1 items-center"
            >
              <Checkbox
                v-model="row.copyCommit"
                binary
                :input-id="`copy-commit-${row._id}`"
                @change="onCopyCommitChange(row)"
              />
              <label
                :for="`copy-commit-${row._id}`"
                class="text-sm cursor-pointer select-none"
              >Копировать текст коммита</label>
              <i
                v-tooltip.top="'После создания задач текст коммита для этой задачи будет скопирован в буфер обмена'"
                class="pi pi-question-circle"
              />
            </div>
          </div>
        </template>
      </Column>

      <Column
        v-if="settings.description"
        header="Описание"
      >
        <template #body="{ data: row }">
          <div class="flex flex-col gap-1">
            <Textarea
              v-if="!row.copyContent"
              v-model="row.description"
              fluid
              rows="2"
              cols="20"
              :pt="{
                root: {
                  style: {
                    minHeight: '35px',
                    resize: 'vertical',
                    display: 'block',
                  }
                }
              }"
            />
            <div class="flex gap-1 items-center">
              <Checkbox
                v-model="row.copyContent"
                binary
                :input-id="`copy-content-${row._id}`"
                @change="onCopyContentChange(row)"
              />
              <label
                :for="`copy-content-${row._id}`"
                class="text-sm cursor-pointer select-none"
              >Скопировать описание</label>
              <i
                v-tooltip.top="'Файловые вложения не копируются'"
                class="pi pi-question-circle"
              />
            </div>
          </div>
        </template>
      </Column>

      <Column header="Исполнитель">
        <template #body="{ data: row }">
          <Select
            v-model="row.responsibleId"
            option-value="id"
            option-label="title"
            :options="users"
            filter
            filter-placeholder="Поиск"
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
        </template>
      </Column>

      <Column header="Стадия">
        <template #body="{ data: row }">
          <Select
            v-model="row.stageId"
            option-value="id"
            option-label="title"
            :options="stages"
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
        </template>
      </Column>

      <Column header="Наблюдатели">
        <template #body="{ data: row }">
          <MultiSelect
            v-model="row.auditorIds"
            option-value="id"
            option-label="title"
            :options="users"
            filter
            filter-placeholder="Поиск"
            fluid
            :max-selected-labels="2"
            placeholder="Выбрать"
          >
            <template #option="{ option }">
              <Avatar
                v-if="option.avatar"
                :image="option.avatar"
                shape="circle"
                size="small"
              />
              {{ option.title }}
            </template>
          </MultiSelect>
        </template>
      </Column>

      <Column style="width: 1%;">
        <template #body="{ index }">
          <Button
            icon="pi pi-times"
            text
            severity="secondary"
            :disabled="rows.length === 1"
            @click="removeRow(index)"
          />
        </template>
      </Column>

      <template #footer>
        <div class="flex gap-2 items-center">
          <Button
            label="Добавить"
            icon="pi pi-plus"
            text
            severity="secondary"
            size="small"
            @click="addRow"
          />
          <Button
            type="submit"
            label="Создать задачи"
            icon="pi pi-check"
            size="small"
            :loading="isLoading"
          />
        </div>
      </template>
    </DataTable>
  </form>

  <Dialog
    v-model:visible="isSettingsModalOpened"
    header="Настройки"
    dismissable-mask
    modal
  >
    <SettingsForm
      :stages
      :initial="settings"
      :settings-storage-key
      @success="onSaveSettings"
    />
  </Dialog>
</template>
