<script setup>
import { jsonrepair } from 'jsonrepair';
import { Avatar, Badge, Button, Checkbox, Column, DataTable, Dialog, InputGroup, MultiSelect, Password, Select, SelectButton, Textarea } from 'primevue';
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { useAiJob } from '../../../composables/useAiJob.js';
import { PixelToolsApi } from '../../../PixelToolsApi.js';
import {showToast} from '../../../toastHost/showToast.js';
import { getCommitMessage, getTaskUrl } from '../../../utils.js';
import {buildPromptPreview, buildSystemPrompt} from '../buildSystemPrompt.js';
import {parseAiDecompositions} from '../parseAiDecompositions.js';
import DecomposeCard from './DecomposeCard.vue';
import DecomposeQuickMode from './DecomposeQuickMode.vue';
import SettingsForm from './SettingsForm.vue';

const props = defineProps({
  sessionId: {
    type: String,
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

const emit = defineEmits(['success']);

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

const bitrixApi = new BitrixApi(props.sessionId);

const groupId = ref('');
const userId = ref(0);

const users = ref([]);
const stages = ref([]);
const isLoading = ref(false);

const settings = ref({});
const settingsStorageKey = computed(() => `decompose-task-settings-${groupId.value}`);
const isSettingsModalOpened = ref(false);
const parentAuditorIds = ref([]);

const AI_CONTEXT_MAX_LENGTH = 1000;
const aiContextStorageKey = computed(() => `decompose-task-ai-context-${groupId.value}`);
const aiContext = ref('');
const isAiContextModalOpened = ref(false);
const isPromptPreviewModalOpened = ref(false);
const promptPreview = computed(() => buildPromptPreview(props.taskTitle, aiContext.value.trim() || null));

async function onAiContextInput(e) {
  aiContext.value = e.target.value.slice(0, AI_CONTEXT_MAX_LENGTH);
  await chrome.storage.local.set({[aiContextStorageKey.value]: aiContext.value});
}

const isApiKeyModalOpened = ref(false);
const apiKeyInputValue = ref('');

const aiJob = useAiJob(() => `decompose-task-ai-job-${props.taskId}`, {
  onAuthError: () => { isApiKeyModalOpened.value = true; },
});
const aiLoading = aiJob.loading;
const aiProgress = aiJob.progress;
const aiButtonLabel = computed(() => aiLoading.value && aiProgress.value !== null ? `AI декомпозиция (${aiProgress.value}%)` : 'AI декомпозиция');
const formElement = ref(null);
const importDecompositionLoading = ref(false);

async function scrollToRows() {
  await nextTick();
  formElement.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveApiKey() {
  const key = apiKeyInputValue.value.trim();
  if (!key) return;
  const {options} = await chrome.storage.local.get(['options']);
  await chrome.storage.local.set({options: {...(options ?? {}), pixelToolsApiKey: key}});
  isApiKeyModalOpened.value = false;
  await aiDecompose();
}

const defaultAuditors = computed(() => settings.value.defaultAuditors ?? 'inherit');

const VIEW_MODE_STORAGE_KEY = 'decompose-task-view-mode';
const viewMode = ref('cards');

const quickForm = ref({
  titlesText: '',
  responsibleId: null,
  stageId: null,
  auditorIds: [],
});
const viewModeOptions = ['table', 'cards', 'quick'];
const viewModeIcons = { table: 'pi pi-table', cards: 'pi pi-th-large', quick: 'pi pi-bolt' };
const viewModeLabels = { table: 'Таблица', cards: 'Карточки', quick: 'Быстрый режим' };

watch(viewMode, async (newMode) => {
  await chrome.storage.local.set({[VIEW_MODE_STORAGE_KEY]: newMode});
});

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
    _collapsed: false,
    title: props.taskTitle,
    description: '',
    copyContent: settings.value.copyContentDefault ?? false,
    copyCommit: rows.value.length === 0 && (settings.value.copyCommitDefault ?? false),
    responsibleId: !settings.value.defaultResponsible || settings.value.defaultResponsible === 'inherit' ? props.responsiveId : userId.value,
    stageId: settings.value.defaultStageId ?? null,
    auditorIds: defaultAuditors.value === 'all'
      ? users.value.map((u) => u.id)
      : defaultAuditors.value === 'inherit'
        ? [...parentAuditorIds.value]
        : [userId.value],
  };
}

const rows = ref([]);

const allCollapsed = computed(() => rows.value.length > 0 && rows.value.every((row) => row._collapsed));

function toggleCollapseAll() {
  const targetState = !allCollapsed.value;
  rows.value.forEach((row) => { row._collapsed = targetState; });
}

function addRow() {
  if (settings.value.copyPreviousRow && rows.value.length > 0) {
    const prev = rows.value[rows.value.length - 1];
    rows.value.push({
      ...prev,
      _id: rowIdCounter++,
      copyCommit: false,
    });
  } else {
    rows.value.push(createRow());
  }
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

async function submit(overrideRows) {
  const taskRows = overrideRows ?? rows.value;
  isLoading.value = true;
  const total = taskRows.length;

  try {
    let parentDescription = '';
    if (taskRows.some((r) => r.copyContent)) {
      const { data } = await bitrixApi.getTask(props.taskId, ['DESCRIPTION']);
      parentDescription = data?.result?.task?.description ?? '';
    }

    const responses = await bitrixApi.addTasksBatch(taskRows.map((row) => ({
      TITLE: row.title,
      DESCRIPTION: row.copyContent ? parentDescription : row.description,
      CREATED_BY: userId.value,
      RESPONSIBLE_ID: row.responsibleId,
      AUDITORS: row.auditorIds,
      GROUP_ID: groupId.value,
      PARENT_ID: props.taskId,
      STAGE_ID: row.stageId || 0,
    })));

    const createdIds = new Array(taskRows.length).fill(null);
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

    const createdTasks = taskRows
      .map((row, i) => createdIds[i] ? { id: createdIds[i], label: row.title, url: getTaskUrl(groupId.value, createdIds[i], userId.value) } : null)
      .filter(Boolean);

    const commitRowIndex = taskRows.findIndex((r) => r.copyCommit);
    if (commitRowIndex !== -1 && createdIds[commitRowIndex]) {
      const commitRow = taskRows[commitRowIndex];
      const commitId = createdIds[commitRowIndex];
      const commitMessage = getCommitMessage(commitRow.title, commitId);
      try {
        await navigator.clipboard.writeText(commitMessage);
        showToast({
          severity: 'info',
          summary: 'Текст коммита скопирован',
          detail: commitMessage,
          life: 5000,
        });
      } catch (e) {
        console.warn(e);
      }
    }

    const failedCount = total - createdTasks.length;
    const showTasks = settings.value.showCreatedTasks && createdTasks.length > 0;
    showToast({
      severity: failedCount > 0 ? 'warn' : 'success',
      summary: failedCount > 0 ? 'Частично' : 'Готово',
      detail: failedCount > 0
        ? `Создано ${createdTasks.length} из ${total} подзадач (${failedCount} не удалось)`
        : `Создано подзадач: ${total}`,
      links: showTasks ? createdTasks : undefined,
      life: showTasks ? 15000 : 5000,
    });

    emit('success');
  } catch (e) {
    console.warn(e);
    showToast({
      severity: 'error',
      summary: 'Ошибка',
      detail: e.message,
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
    const storedContext = await chrome.storage.local.get([aiContextStorageKey.value]);
    if (storedContext[aiContextStorageKey.value]) aiContext.value = storedContext[aiContextStorageKey.value];

    const storedViewMode = await chrome.storage.local.get([VIEW_MODE_STORAGE_KEY]);
    if (storedViewMode[VIEW_MODE_STORAGE_KEY]) viewMode.value = storedViewMode[VIEW_MODE_STORAGE_KEY];

    const [groupUsers, stagesResponse, currentUser] = await Promise.all([
      bitrixApi.getGroupUsers(groupId.value),
      bitrixApi.getStages(groupId.value),
      bitrixApi.getCurrentUser(),
    ]);
    if (!currentUser) throw new Error('Не удалось получить данные текущего пользователя');
    userId.value = Number(currentUser.ID);

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
    quickForm.value = {
      titlesText: '',
      responsibleId: !settings.value.defaultResponsible || settings.value.defaultResponsible === 'inherit'
        ? props.responsiveId
        : userId.value,
      stageId: settings.value.defaultStageId ?? null,
      auditorIds: defaultAuditors.value === 'all'
        ? users.value.map((u) => u.id)
        : defaultAuditors.value === 'inherit'
          ? [...parentAuditorIds.value]
          : [userId.value],
    };
  } catch (e) {
    console.warn(e);
    showToast({
      severity: 'error',
      summary: 'Ошибка',
      detail: e.message,
      life: 5000,
    });
  } finally {
    isLoading.value = false;
  }
}

function applyDecomposeItems(items) {
  if (viewMode.value === 'quick') {
    quickForm.value.titlesText = items.map((item) => item.title).join('\n');
    return;
  }

  const auditorIds = defaultAuditors.value === 'all'
    ? users.value.map((u) => u.id)
    : defaultAuditors.value === 'inherit'
      ? [...parentAuditorIds.value]
      : [userId.value];
  const responsibleId = !settings.value.defaultResponsible || settings.value.defaultResponsible === 'inherit'
    ? props.responsiveId
    : userId.value;

  rows.value = items.map((item) => ({
    _id: rowIdCounter++,
    _collapsed: false,
    title: item.title,
    description: item.description ?? '',
    copyContent: false,
    copyCommit: false,
    responsibleId,
    stageId: settings.value.defaultStageId ?? null,
    auditorIds: [...auditorIds],
  }));
}

function applyAiDecomposeResult(rawResult) {
  const parsed = JSON.parse(jsonrepair(rawResult));
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('AI вернул пустой список подзадач');

  applyDecomposeItems(parsed.map((item) => ({
    title: item.title ?? '',
    description: settings.value.description ? (item.description ?? '') : '',
  })));
}

async function importReadyDecomposition() {
  importDecompositionLoading.value = true;
  try {
    const { data } = await bitrixApi.getTask(props.taskId, ['DESCRIPTION']);
    const description = data?.result?.task?.description ?? '';
    const items = parseAiDecompositions(description);

    if (!items) {
      showToast({
        severity: 'warn',
        summary: 'Готовая декомпозиция',
        detail: 'В описании задачи не найден блок [AI_DECOMPOSITIONS]',
        life: 5000,
      });
      return;
    }

    applyDecomposeItems(items.map((item) => ({
      title: item.points != null ? `${item.title} | ${item.points}` : item.title,
    })));
    await scrollToRows();

    showToast({
      severity: 'success',
      summary: 'Готовая декомпозиция',
      detail: `Импортировано подзадач: ${items.length}`,
      life: 5000,
    });
  } catch (e) {
    console.warn(e);
    showToast({
      severity: 'error',
      summary: 'Ошибка',
      detail: e.message,
      life: 5000,
    });
  } finally {
    importDecompositionLoading.value = false;
  }
}

async function aiDecompose() {
  const apiKey = await aiJob.getApiKey();
  if (!apiKey) {
    isApiKeyModalOpened.value = true;
    return;
  }

  const {onStart, onProgress} = aiJob.chatCallbacks();
  await aiJob.runJob(async () => {
    const fields = settings.value.description ? ['TITLE', 'DESCRIPTION'] : ['TITLE'];
    const { data } = await bitrixApi.getTask(props.taskId, fields);
    const title = data?.result?.task?.title ?? props.taskTitle;
    const description = settings.value.description ? (data?.result?.task?.description ?? '') : '';

    const MAX_PROMPT_LENGTH = 20000;
    let prompt = buildSystemPrompt(title, description, aiContext.value);
    if (prompt.length > MAX_PROMPT_LENGTH) {
      prompt = prompt.slice(0, MAX_PROMPT_LENGTH);
      showToast({ severity: 'warn', summary: 'AI', detail: `Описание задачи обрезано — промпт превышал ${MAX_PROMPT_LENGTH} символов`, life: 5000 });
    }

    return new PixelToolsApi(apiKey).chat(prompt, '', onProgress, onStart);
  }, async (rawResult) => {
    applyAiDecomposeResult(rawResult);
    await scrollToRows();
  });
}

async function resumeAiDecompose(reportId, initialProgress) {
  const apiKey = await aiJob.getApiKey();
  if (!apiKey) {
    // Без ключа продолжить опрос невозможно — забываем задачу, чтобы не пытаться бесконечно
    await aiJob.forget();
    return;
  }

  aiProgress.value = initialProgress ?? 1;

  await aiJob.runJob(
    () => new PixelToolsApi(apiKey).resumeChat(reportId, aiJob.resumeProgressCallback(reportId), initialProgress),
    async (rawResult) => {
      applyAiDecomposeResult(rawResult);
      await scrollToRows();
    },
  );
}

onMounted(async () => {
  await fetchData();

  const job = await aiJob.getPendingJob();
  if (job?.reportId) resumeAiDecompose(job.reportId, job.progress);
});
</script>

<template>
  <form
    ref="formElement"
    class="min-w-[800px]"
    @submit.prevent="() => submit()"
  >
    <div class="flex gap-1 items-center mb-2">
      <Button
        icon="pi pi-cog"
        label="Настройки"
        size="small"
        severity="secondary"
        variant="text"
        :disabled="isLoading || aiLoading"
        @click="isSettingsModalOpened = true"
      />
      <InputGroup
        v-if="!isLoading && viewMode !== 'quick'"
        :pt="{root: {style: {width: 'auto'}}}"
      >
        <Button
          icon="pi pi-sparkles"
          :label="aiButtonLabel"
          size="small"
          outlined
          severity="secondary"
          :loading="aiLoading"
          :disabled="isLoading"
          @click="aiDecompose"
        />
        <Button
          v-tooltip="'Доп. контекст для AI'"
          size="small"
          severity="secondary"
          :icon="aiContext.trim() ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
          :disabled="isLoading"
          @click="isAiContextModalOpened = true"
        />
        <Button
          v-tooltip="'Просмотр системного промпта'"
          size="small"
          severity="secondary"
          icon="pi pi-eye"
          :disabled="isLoading"
          @click="isPromptPreviewModalOpened = true"
        />
      </InputGroup>
      <Button
        v-if="!isLoading"
        v-tooltip="'Найти в описании задачи блок [AI_DECOMPOSITIONS] (готовая декомпозиция от AI-оценки) и подставить подзадачи из него'"
        icon="pi pi-file-import"
        label="Готовая декомпозиция"
        size="small"
        outlined
        severity="secondary"
        :loading="importDecompositionLoading"
        :disabled="aiLoading"
        @click="importReadyDecomposition"
      />
      <SelectButton
        v-model="viewMode"
        :options="viewModeOptions"
        :allow-empty="false"
        size="small"
        class="ml-auto"
      >
        <template #option="{ option }">
          <i
            v-tooltip.top="viewModeLabels[option]"
            :class="viewModeIcons[option]"
          />
        </template>
      </SelectButton>
    </div>

    <DataTable
      v-if="viewMode === 'table'"
      :value="rows"
      :loading="isLoading || aiLoading"
      data-key="_id"
      size="small"
      striped-rows
    >
      <Column header="Название">
        <template #body="{ data: row }">
          <div class="flex flex-col gap-1">
            <Textarea
              v-model="row.title"
              fluid
              rows="2"
              cols="40"
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
            :disabled="rows.length === 1 || aiLoading"
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
            :disabled="aiLoading"
            @click="addRow"
          />
          <Button
            type="submit"
            label="Создать задачи"
            icon="pi pi-check"
            size="small"
            :loading="isLoading"
            :disabled="aiLoading"
          />
        </div>
      </template>
    </DataTable>

    <div
      v-else-if="viewMode === 'cards'"
      class="flex flex-col gap-3"
    >
      <div
        v-if="isLoading || aiLoading"
        class="flex items-center justify-center p-8 text-surface-500 dark:text-surface-400"
      >
        Загрузка...
      </div>

      <template v-else>
        <DecomposeCard
          v-for="(row, index) in rows"
          :key="row._id"
          v-model="rows[index]"
          :index="index"
          :settings="settings"
          :users="users"
          :stages="stages"
          :is-only-row="rows.length === 1"
          :ai-loading="aiLoading"
          @remove="removeRow(index)"
          @copy-commit-change="onCopyCommitChange(row)"
        />
      </template>

      <div class="flex gap-2 items-center">
        <Button
          label="Добавить"
          icon="pi pi-plus"
          text
          severity="secondary"
          size="small"
          :disabled="aiLoading || isLoading"
          @click="addRow"
        />
        <Button
          :label="allCollapsed ? 'Развернуть все' : 'Свернуть все'"
          :icon="`pi pi-chevron-${allCollapsed ? 'down' : 'up'}`"
          text
          severity="secondary"
          size="small"
          :disabled="aiLoading || isLoading"
          @click="toggleCollapseAll"
        />
        <Button
          type="submit"
          label="Создать задачи"
          icon="pi pi-check"
          size="small"
          :loading="isLoading"
          :disabled="aiLoading"
        />
      </div>
    </div>

    <div
      v-else
      class="flex flex-col gap-3"
    >
      <div
        v-if="isLoading"
        class="flex items-center justify-center p-8 text-surface-500 dark:text-surface-400"
      >
        Загрузка...
      </div>

      <DecomposeQuickMode
        v-else
        v-model="quickForm"
        :users="users"
        :stages="stages"
        :is-loading="isLoading"
        @submit="submit($event)"
      />
    </div>
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

  <Dialog
    v-model:visible="isApiKeyModalOpened"
    header="API ключ Пиксель Тулс"
    dismissable-mask
    modal
    :style="{width: '400px'}"
  >
    <form @submit.prevent="saveApiKey">
      <Password
        v-model="apiKeyInputValue"
        size="small"
        :feedback="false"
        toggle-mask
        fluid
        placeholder="Введите API ключ"
        :input-props="{autocomplete: 'new-password'}"
      />
      <p class="text-xs text-surface-400 dark:text-surface-500 mt-1 mb-3">
        <a
          href="https://tools.pixelplus.ru/"
          target="_blank"
          class="underline"
        >tools.pixelplus.ru</a>
        → Меню → Настройки аккаунта → Ключ для доступа по API
      </p>
      <Button
        type="submit"
        label="Сохранить"
        size="small"
        :disabled="!apiKeyInputValue.trim()"
      />
    </form>
  </Dialog>

  <Dialog
    v-model:visible="isAiContextModalOpened"
    header="Доп. контекст для AI"
    dismissable-mask
    modal
    :style="{width: '480px'}"
  >
    <p class="text-sm text-surface-500 dark:text-surface-400 mb-3">
      Дополнительная информация для AI: стек, ограничения, пожелания по декомпозиции.
    </p>
    <div class="relative">
      <Textarea
        :value="aiContext"
        :maxlength="AI_CONTEXT_MAX_LENGTH"
        rows="6"
        fluid
        placeholder="Например: бэкенд на Laravel, фронт на Vue 3, разбить максимум на 3 подзадачи..."
        @input="onAiContextInput"
      />
      <span class="absolute bottom-2 right-2 text-xs text-surface-400 dark:text-surface-500 pointer-events-none">
        {{ aiContext.length }} / {{ AI_CONTEXT_MAX_LENGTH }}
      </span>
    </div>
  </Dialog>

  <Dialog
    v-model:visible="isPromptPreviewModalOpened"
    header="Системный промпт"
    dismissable-mask
    modal
    :style="{width: '760px'}"
  >
    <pre
      class="text-xs font-mono whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto overflow-x-hidden"
      v-html="promptPreview"
    />
    <div class="text-right text-xs text-surface-400 dark:text-surface-500 mt-2">
      {{ promptPreview.length }} символов
    </div>
  </Dialog>
</template>
