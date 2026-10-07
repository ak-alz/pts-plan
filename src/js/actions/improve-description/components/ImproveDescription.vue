<script setup>
import dayjs from 'dayjs';
import { Button, Checkbox, Dialog, Message, SelectButton, Skeleton, Step, StepList, StepPanel, StepPanels, Stepper, Textarea } from 'primevue';
import { computed, onMounted, reactive, ref, toRaw, useTemplateRef, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { useAiJob } from '../../../composables/useAiJob.js';
import { usePromptLibrary } from '../../../composables/usePromptLibrary.js';
import { buildDescriptionFiles, collectPageImages, createEditorAttachments, getDiskFileIds } from '../../../editorFiles.js';
import { AI_CODE_FENCE_RE, DISK_FILE_TAG_RE } from '../../../patterns.js';
import { PixelToolsApi } from '../../../PixelToolsApi.js';
import { renderAiMarkdown } from '../../../renderAiMarkdown.js';
import { showToast } from '../../../toastHost/showToast.js';
import AiApiKeyDialog from '../../../ui/AiApiKeyDialog.vue';
import BbcodeEditor from '../../../ui/BbcodeEditor.vue';
import EditorAttachments from '../../../ui/EditorAttachments.vue';
import PromptLibraryButton from '../../../ui/PromptLibraryButton.vue';
import { bbcodeToMarkdown, downloadBlob, estimateTokenCount, isSystemComment } from '../../../utils.js';
import { buildPrompt, buildRecommendationsSection, buildTaskBlock } from '../buildPrompt.js';
import { PROMPT_SPECS } from '../promptSpec.js';
import {
  AI_CONTEXT_MAX_LENGTH,
  ANSWERS_PROMPT,
  CONTEXT_PARTS,
  getAiContextStorageKey,
  getAiJobStorageKey,
  getBackupStorageKey,
  MAX_PROMPT_LENGTH,
  MAX_TREE_DEPTH,
  MODE,
  MODE_OPTIONS,
  SETTINGS_STORAGE_KEY,
} from '../variables.js';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  taskId: {
    type: String,
    required: true,
  },
});

const bitrixApi = new BitrixApi(props.sessionId);

const loading = ref(true);
const context = reactive({
  title: '',
  description: '',
  status: '',
  stageName: '',
  groupId: '',
  parentId: '',
  creatorName: '',
  responsibleName: '',
  createdDate: '',
  deadline: '',
  startDatePlan: '',
  endDatePlan: '',
  // Ленивые части: null — ещё не загружены
  checklist: null,
  comments: null,
  // Всё дерево плоским списком в порядке обхода: [{id, title, status, depth}]
  subtasks: null,
  // ID подзадачи → её комментарии
  subtaskComments: null,
  // Цепочка предков от корневой задачи к прямому родителю: [{id, title, description, status}]
  parents: null,
  // ID родительской задачи → её комментарии
  parentComments: null,
});
// Части контекста, которые грузятся лениво — только когда их галка включена
const loadingParts = reactive({
  checklist: false, comments: false, subtasks: false, subtaskComments: false, parent: false, parentComments: false,
});

/* Настройки: режим и состав контекста */
const mode = ref(MODE.REWRITE);
const include = reactive(Object.fromEntries(CONTEXT_PARTS.map((part) => [part.key, part.default])));
// Недостающее — пометками «уточнить» прямо в тексте, а не разделом «Открытые вопросы» в конце
const inlineGaps = ref(false);
let settingsLoaded = false;

watch([mode, include, inlineGaps], () => {
  if (!settingsLoaded) return;
  chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: { mode: mode.value, include: { ...toRaw(include) }, inlineGaps: inlineGaps.value },
  });
}, { deep: true });

const promptLibraries = {
  [MODE.REWRITE]: usePromptLibrary(PROMPT_SPECS[MODE.REWRITE]),
  [MODE.RECOMMEND]: usePromptLibrary(PROMPT_SPECS[MODE.RECOMMEND]),
  [ANSWERS_PROMPT]: usePromptLibrary(PROMPT_SPECS[ANSWERS_PROMPT]),
};

// Новое описание в режиме рекомендаций — второй шаг со своим промптом
function isAnswersStep(promptMode) {
  return promptMode === MODE.REWRITE && mode.value === MODE.RECOMMEND;
}

function getPromptLibrary(promptMode) {
  return promptLibraries[isAnswersStep(promptMode) ? ANSWERS_PROMPT : promptMode];
}
const isPromptPreviewOpened = ref(false);

const aiContext = ref('');

async function onAiContextInput(event) {
  aiContext.value = event.target.value.slice(0, AI_CONTEXT_MAX_LENGTH);
  await chrome.storage.local.set({ [getAiContextStorageKey(context.groupId)]: aiContext.value });
}

/* Шаги и результаты */
const activeStep = ref('1');
// PrimeVue выводит value шага как его номер: без шага рекомендаций результат должен быть вторым, а не третьим
const resultStep = computed(() => (mode.value === MODE.RECOMMEND ? '3' : '2'));
const recommendations = ref('');
const answers = ref('');
const newDescription = ref('');
const resultView = ref('editor');
const RESULT_VIEW_OPTIONS = [
  { label: 'Редактор', value: 'editor' },
  { label: 'BBCode', value: 'bbcode' },
  { label: 'Было', value: 'before' },
];
const descriptionEditor = useTemplateRef('descriptionEditor');
const attachments = createEditorAttachments(bitrixApi);
const isUploadingFiles = attachments.isUploading;
// Картинки текущего описания — чтобы и в новом они были видны в редакторе, а не тегами
const editorFiles = ref([]);

// Правки из визуального редактора приходят с задержкой — забираем их, пока он не исчез с экрана
async function changeResultView(view) {
  await descriptionEditor.value?.sync();
  resultView.value = view;
}

const isApiKeyDialogOpened = ref(false);
let retryAfterApiKey = null;

const jobs = {
  [MODE.REWRITE]: useAiJob(() => getAiJobStorageKey(props.taskId, MODE.REWRITE), { onAuthError: openApiKeyDialog }),
  [MODE.RECOMMEND]: useAiJob(() => getAiJobStorageKey(props.taskId, MODE.RECOMMEND), { onAuthError: openApiKeyDialog }),
};
const aiLoading = computed(() => jobs[MODE.REWRITE].loading.value || jobs[MODE.RECOMMEND].loading.value);
const isContextLoading = computed(() => Object.values(loadingParts).some(Boolean));

// Процент — у кнопки того запроса, который идёт, а не у всех кнопок AI сразу
function withProgress(label, promptMode) {
  const job = jobs[promptMode];
  return job.loading.value && job.progress.value !== null ? `${label} (${job.progress.value}%)` : label;
}

function openApiKeyDialog() {
  isApiKeyDialogOpened.value = true;
}

function onApiKeySaved() {
  const retry = retryAfterApiKey;
  retryAfterApiKey = null;
  retry?.();
}

/* Загрузка данных задачи */
async function loadTask() {
  const { data } = await bitrixApi.getTask(props.taskId, [
    'TITLE', 'DESCRIPTION', 'STATUS', 'STAGE_ID', 'GROUP_ID', 'PARENT_ID', 'CREATED_BY', 'RESPONSIBLE_ID',
    'CREATED_DATE', 'DEADLINE', 'START_DATE_PLAN', 'END_DATE_PLAN',
  ]);
  const task = data?.result?.task ?? {};

  Object.assign(context, {
    title: task.title ?? '',
    description: task.description ?? '',
    status: String(task.status ?? ''),
    groupId: String(task.groupId ?? '0'),
    parentId: task.parentId && String(task.parentId) !== '0' ? String(task.parentId) : '',
    createdDate: task.createdDate ?? '',
    deadline: task.deadline ?? '',
    startDatePlan: task.startDatePlan ?? '',
    endDatePlan: task.endDatePlan ?? '',
  });

  const userIds = [...new Set([task.createdBy, task.responsibleId].filter(Boolean).map(String))];
  const [users, stagesResponse] = await Promise.all([
    userIds.length ? bitrixApi.getImUsersBatch(userIds).catch(() => ({})) : {},
    context.groupId !== '0' && task.stageId ? bitrixApi.getStages(context.groupId).catch(() => null) : null,
  ]);

  const userName = (userId) => {
    const user = users[String(userId)];
    return user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  };
  context.creatorName = userName(task.createdBy);
  context.responsibleName = userName(task.responsibleId);
  context.stageName = Object.values(stagesResponse?.data?.result ?? {})
    .find((stage) => String(stage.ID) === String(task.stageId))?.TITLE ?? '';
}

// Комментарии нескольких задач одним батчем, без системных
async function loadUserComments(taskIds) {
  const commentsByTaskId = await bitrixApi.getCommentsBatch(taskIds);
  return Object.fromEntries(taskIds.map((taskId) => [
    taskId,
    (commentsByTaskId[taskId] ?? []).filter((comment) => !isSystemComment(comment)),
  ]));
}

const PART_LOADERS = {
  async checklist() {
    context.checklist = await bitrixApi.getChecklistItems(props.taskId);
  },
  async comments() {
    const comments = await bitrixApi.getComments(props.taskId);
    context.comments = comments.filter((comment) => !isSystemComment(comment));
  },
  // Дерево обходим по уровням: один запрос на уровень по всем его задачам сразу
  async subtasks() {
    const childrenByParentId = new Map();
    const visitedIds = new Set([String(props.taskId)]);
    let levelIds = [props.taskId];
    for (let depth = 0; depth < MAX_TREE_DEPTH && levelIds.length; depth++) {
      const levelTasks = await bitrixApi.searchTasks({ parentIds: levelIds, selectFields: ['ID', 'TITLE', 'STATUS', 'PARENT_ID'] });
      levelTasks.forEach((task) => {
        const parentKey = String(task.parentId);
        if (!childrenByParentId.has(parentKey)) childrenByParentId.set(parentKey, []);
        childrenByParentId.get(parentKey).push(task);
      });
      levelIds = levelTasks.map((task) => String(task.id)).filter((taskId) => !visitedIds.has(taskId));
      levelIds.forEach((taskId) => visitedIds.add(taskId));
    }

    const flatten = (parentId, depth) => (childrenByParentId.get(String(parentId)) ?? []).flatMap((task) => [
      { id: String(task.id), title: task.title ?? '', status: String(task.status ?? ''), depth },
      ...flatten(task.id, depth + 1),
    ]);
    context.subtasks = flatten(props.taskId, 0);
  },
  async subtaskComments() {
    await loadPart('subtasks');
    if (!context.subtasks) throw new Error('Подзадачи не загрузились');
    context.subtaskComments = await loadUserComments(context.subtasks.map((subtask) => subtask.id));
  },
  async parent() {
    const ancestors = await bitrixApi.getAncestorTasks(
      [{ id: props.taskId, parentId: context.parentId }],
      { selectFields: ['TITLE', 'DESCRIPTION', 'STATUS'], maxDepth: MAX_TREE_DEPTH },
    );
    // Поднимаемся от прямого родителя, а храним от корня: контекст читается от общего к частному
    const chain = [];
    let parentId = context.parentId;
    while (parentId && ancestors[parentId] && !chain.some((parent) => parent.id === parentId)) {
      const ancestor = ancestors[parentId];
      chain.unshift({
        id: parentId,
        title: ancestor.title ?? '',
        description: ancestor.description ?? '',
        status: String(ancestor.status ?? ''),
      });
      parentId = ancestor.parentId && String(ancestor.parentId) !== '0' ? String(ancestor.parentId) : '';
    }
    context.parents = chain;
  },
  async parentComments() {
    await loadPart('parent');
    if (!context.parents) throw new Error('Родительские задачи не загрузились');
    context.parentComments = await loadUserComments(context.parents.map((parent) => parent.id));
  },
};

const CONTEXT_KEY_BY_PART = { parent: 'parents' };

function isPartLoaded(key) {
  if ((key === 'parent' || key === 'parentComments') && !context.parentId) return true;
  return context[CONTEXT_KEY_BY_PART[key] ?? key] !== null;
}

// Запросы в полёте: комментарии подзадач и родителей ждут загрузки самих задач, и повторный
// вызов должен дождаться того же запроса, а не уйти ни с чем
const partRequests = {};

function loadPart(key) {
  if (isPartLoaded(key)) return Promise.resolve();
  partRequests[key] ??= (async () => {
    loadingParts[key] = true;
    try {
      await PART_LOADERS[key]();
    } catch (error) {
      console.warn(error);
      include[key] = false;
      showToast({ severity: 'warn', summary: 'Контекст для ИИ', detail: 'Не удалось загрузить часть данных задачи — она отключена.', life: 5000 });
    } finally {
      loadingParts[key] = false;
      delete partRequests[key];
    }
  })();
  return partRequests[key];
}

function loadEnabledParts() {
  return Promise.all(Object.keys(PART_LOADERS).filter((key) => include[key]).map(loadPart));
}

watch(() => ({ ...include }), () => {
  if (!loading.value) loadEnabledParts();
});

function countComments(commentsByTaskId) {
  return commentsByTaskId ? Object.values(commentsByTaskId).reduce((total, comments) => total + comments.length, 0) : null;
}

// Сколько данных в каждой части — рядом с галкой, когда часть уже загружена
const partCounts = computed(() => ({
  checklist: context.checklist?.filter((item) => String(item.PARENT_ID) !== '0').length ?? null,
  comments: context.comments?.length ?? null,
  subtasks: context.subtasks?.length ?? null,
  subtaskComments: countComments(context.subtaskComments),
  parent: context.parents?.length ?? null,
  parentComments: countComments(context.parentComments),
}));

/* Промпт */
const taskBlock = computed(() => buildTaskBlock(context, include));

function getPrompt(promptMode) {
  const values = {
    taskData: taskBlock.value,
    extraContext: aiContext.value,
    // Второй этап: переписываем с учётом рекомендаций и ответов постановщика
    recommendationsSection: isAnswersStep(promptMode)
      ? buildRecommendationsSection(recommendations.value, answers.value, { inlineGaps: inlineGaps.value })
      : '',
  };
  return getPromptLibrary(promptMode).buildActivePrompt(values)
    ?? buildPrompt({ mode: promptMode, ...values, inlineGaps: inlineGaps.value });
}

// Какой промпт открыт в окне просмотра: на шаге рекомендаций смотрят уже промпт нового описания
const previewPromptMode = ref(MODE.REWRITE);
const previewPrompt = computed(() => getPrompt(previewPromptMode.value));
const previewTokenEstimate = computed(() => estimateTokenCount(previewPrompt.value));

function openPromptPreview(promptMode) {
  previewPromptMode.value = promptMode;
  isPromptPreviewOpened.value = true;
}

const promptTokenEstimate = computed(() => estimateTokenCount(getPrompt(mode.value)));

/* Генерация */
async function generate(promptMode) {
  const job = jobs[promptMode];
  const apiKey = await job.getApiKey();
  if (!apiKey) {
    retryAfterApiKey = () => generate(promptMode);
    openApiKeyDialog();
    return;
  }

  const { onStart, onProgress } = job.chatCallbacks();
  await job.runJob(async () => {
    await Promise.all([loadEnabledParts(), getPromptLibrary(promptMode).ready]);

    let prompt = getPrompt(promptMode);
    if (prompt.length > MAX_PROMPT_LENGTH) {
      prompt = prompt.slice(0, MAX_PROMPT_LENGTH);
      showToast({ severity: 'warn', summary: 'ИИ', detail: `Промпт длиннее ${MAX_PROMPT_LENGTH} символов — конец (старые комментарии) обрезан`, life: 6000 });
    }

    return new PixelToolsApi(apiKey).chat(prompt, '', onProgress, onStart);
  }, (result) => applyAiResult(promptMode, result));
}

function applyAiResult(promptMode, result) {
  if (promptMode === MODE.RECOMMEND) {
    recommendations.value = result.trim();
    activeStep.value = '2';
    return;
  }

  newDescription.value = result.replace(AI_CODE_FENCE_RE, '').trim();
  resultView.value = 'editor';
  applied.value = false;
  activeStep.value = resultStep.value;
}

async function resumePendingJobs() {
  for (const promptMode of [MODE.RECOMMEND, MODE.REWRITE]) {
    const job = jobs[promptMode];
    const pending = await job.getPendingJob();
    if (!pending?.reportId) continue;

    const apiKey = await job.getApiKey();
    if (!apiKey) {
      await job.forget();
      continue;
    }

    job.progress.value = pending.progress ?? 1;
    job.runJob(
      () => new PixelToolsApi(apiKey).resumeChat(pending.reportId, job.resumeProgressCallback(pending.reportId), pending.progress),
      (result) => applyAiResult(promptMode, result),
    );
  }
}

/* Результат и замена описания */
// Вставленные в текст файлы ИИ мог потерять — без плейсхолдера файл пропадёт из описания
// Сравниваем по ID, а не строкой: визуальный редактор переписывает теги строчными буквами
const lostFileTags = computed(() => {
  const fileIdsInNew = getDiskFileIds(newDescription.value);
  const lostTags = new Map();
  for (const [tag, fileId] of context.description.matchAll(DISK_FILE_TAG_RE)) {
    if (!fileIdsInNew.has(fileId.toLowerCase())) lostTags.set(fileId.toLowerCase(), tag);
  }
  return [...lostTags.values()];
});

const finalDescription = computed(() => (lostFileTags.value.length
  ? `${newDescription.value.trim()}\n\n${lostFileTags.value.join('\n')}`
  : newDescription.value.trim()));

function renderBbcode(text) {
  return renderAiMarkdown(bbcodeToMarkdown(text));
}

const applying = ref(false);
const applied = ref(false);
const rollingBack = ref(false);
const backup = ref(null);

// Отказ Bitrix (нет прав на изменение задачи и т. п.) приходит HTTP-ошибкой, и axios прячет
// понятное error_description за общим «Request failed with status code 400»
async function updateDescription(description) {
  try {
    const { data } = await bitrixApi.updateTask(props.taskId, { DESCRIPTION: description });
    if (!data?.result) throw new Error(data?.error_description || 'Bitrix не подтвердил изменение задачи');
  } catch (error) {
    const bitrixMessage = error.response?.data?.error_description;
    throw bitrixMessage ? new Error(bitrixMessage) : error;
  }
}

async function applyDescription() {
  applying.value = true;
  try {
    await descriptionEditor.value?.sync();
    const previousDescription = context.description;
    await attachments.attachToTask(props.taskId);
    await updateDescription(finalDescription.value);

    backup.value = { description: previousDescription, savedAt: Date.now() };
    await chrome.storage.local.set({ [getBackupStorageKey(props.taskId)]: backup.value });

    context.description = finalDescription.value;
    applied.value = true;
    showToast({ severity: 'success', summary: 'Описание задачи обновлено', detail: 'Обновите страницу, чтобы увидеть новое описание.', life: 5000 });
  } catch (error) {
    console.warn(error);
    showToast({ severity: 'error', summary: 'Не удалось обновить описание', detail: error.message, life: 6000 });
  } finally {
    applying.value = false;
  }
}

async function rollback() {
  if (!backup.value) return;
  rollingBack.value = true;
  try {
    await updateDescription(backup.value.description);
    context.description = backup.value.description;
    backup.value = null;
    applied.value = false;
    await chrome.storage.local.remove(getBackupStorageKey(props.taskId));
    showToast({ severity: 'success', summary: 'Старое описание возвращено', detail: 'Обновите страницу, чтобы его увидеть.', life: 5000 });
  } catch (error) {
    console.warn(error);
    showToast({ severity: 'error', summary: 'Не удалось вернуть описание', detail: error.message, life: 6000 });
  } finally {
    rollingBack.value = false;
  }
}

async function forgetBackup() {
  backup.value = null;
  await chrome.storage.local.remove(getBackupStorageKey(props.taskId));
}

function downloadDescription(description, suffix) {
  downloadBlob(new Blob([description], { type: 'text/plain;charset=utf-8' }), `task-${props.taskId}-description-${suffix}.txt`);
}

function reloadPage() {
  window.location.reload();
}

onMounted(async () => {
  try {
    const stored = await chrome.storage.local.get([SETTINGS_STORAGE_KEY, getBackupStorageKey(props.taskId)]);
    const settings = stored[SETTINGS_STORAGE_KEY];
    if (settings) {
      mode.value = settings.mode ?? MODE.REWRITE;
      Object.assign(include, settings.include ?? {});
      inlineGaps.value = settings.inlineGaps ?? false;
    }
    backup.value = stored[getBackupStorageKey(props.taskId)] ?? null;
    settingsLoaded = true;

    await loadTask();
    const descriptionElement = document.querySelector('#task-detail-description');
    editorFiles.value = descriptionElement
      ? buildDescriptionFiles(context.description, collectPageImages(descriptionElement))
      : [];

    const storedContext = await chrome.storage.local.get([getAiContextStorageKey(context.groupId)]);
    aiContext.value = storedContext[getAiContextStorageKey(context.groupId)] ?? '';
  } catch (error) {
    console.warn(error);
    showToast({ severity: 'error', summary: 'Не удалось загрузить задачу', detail: error.message, life: 5000 });
  } finally {
    loading.value = false;
  }

  loadEnabledParts();
  resumePendingJobs();
});
</script>

<template>
  <div
    v-if="loading"
    class="flex flex-col gap-3 py-2"
  >
    <Skeleton height="24px" />
    <Skeleton height="24px" />
    <Skeleton height="24px" />
  </div>

  <Stepper
    v-else
    v-model:value="activeStep"
  >
    <StepList>
      <Step value="1">
        Настройка
      </Step>
      <Step
        v-if="mode === MODE.RECOMMEND"
        value="2"
        :disabled="!recommendations"
      >
        Рекомендации
      </Step>
      <Step
        :value="resultStep"
        :disabled="!newDescription"
      >
        Новое описание
      </Step>
    </StepList>

    <StepPanels>
      <StepPanel value="1">
        <div class="flex flex-col gap-4 pt-3">
          <Message
            v-if="backup && !applied"
            severity="info"
            size="small"
            :closable="false"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span>Описание меняли через ИИ {{ dayjs(backup.savedAt).format('DD.MM.YYYY HH:mm') }} — старая версия сохранена.</span>
              <Button
                label="Откатить"
                icon="pi pi-undo"
                size="small"
                severity="secondary"
                :loading="rollingBack"
                @click="rollback"
              />
              <Button
                label="Скачать .txt"
                icon="pi pi-download"
                size="small"
                severity="secondary"
                variant="text"
                @click="downloadDescription(backup.description, 'before-ai')"
              />
              <Button
                label="Забыть"
                size="small"
                severity="secondary"
                variant="text"
                @click="forgetBackup"
              />
            </div>
          </Message>

          <SelectButton
            v-model="mode"
            :options="MODE_OPTIONS"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :disabled="aiLoading"
            size="small"
          />
          <p class="m-0 text-xs text-surface-500 dark:text-surface-400">
            <template v-if="mode === MODE.REWRITE">
              Нейросеть подготовит новое описание. Задача пока не изменится: на следующем шаге вы увидите результат, сможете его поправить и сами решите, заменять ли описание.
            </template>
            <template v-else>
              Сначала нейросеть подскажет, чего не хватает в описании, и задаст вопросы. Ответьте на них — и она подготовит новое описание с учётом ответов. Задача изменится, только когда вы сами замените описание на последнем шаге.
            </template>
          </p>

          <div class="flex items-center gap-2">
            <Checkbox
              v-model="inlineGaps"
              binary
              input-id="improve-description-inline-gaps"
            />
            <label
              for="improve-description-inline-gaps"
              class="text-sm cursor-pointer select-none"
            >Недостающее — пометками «уточнить» прямо в тексте</label>
            <i
              v-tooltip.top="'Как в быстром создании задачи: вместо раздела «Открытые вопросы» в конце нейросеть оставит пометки «(уточнить: …)» там, где не хватает данных, и сохранит структуру шаблона, если он уже есть в описании. Получится заготовка, которую остаётся дописать.'"
              class="pi pi-question-circle text-surface-400 dark:text-surface-500"
            />
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-sm font-medium">Что передать нейросети</span>
            <span class="text-xs text-surface-500 dark:text-surface-400">Название и текущее описание передаются всегда.</span>
            <div class="grid grid-cols-2 gap-2">
              <template
                v-for="part in CONTEXT_PARTS"
                :key="part.key"
              >
                <div
                  v-if="!part.needsParent || context.parentId"
                  class="flex items-center gap-2"
                >
                  <Checkbox
                    v-model="include[part.key]"
                    binary
                    :input-id="`improve-description-${part.key}`"
                  />
                  <label
                    :for="`improve-description-${part.key}`"
                    class="text-sm cursor-pointer select-none"
                  >
                    {{ part.label }}
                    <span
                      v-if="partCounts[part.key] !== null && partCounts[part.key] !== undefined"
                      class="text-xs text-surface-400 dark:text-surface-500"
                    >{{ partCounts[part.key] }}</span>
                  </label>
                  <i
                    v-if="loadingParts[part.key]"
                    class="pi pi-spinner pi-spin text-surface-400 dark:text-surface-500"
                  />
                </div>
              </template>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label
              for="improve-description-ai-context"
              class="text-sm font-medium"
            >Доп. контекст</label>
            <div class="relative">
              <Textarea
                id="improve-description-ai-context"
                :value="aiContext"
                :maxlength="AI_CONTEXT_MAX_LENGTH"
                rows="3"
                fluid
                placeholder="Например: проект на Laravel + Vue, заказчик — интернет-магазин, важна мобильная версия…"
                @input="onAiContextInput"
              />
              <span class="absolute bottom-2 right-2 text-xs text-surface-400 dark:text-surface-500 pointer-events-none">
                {{ aiContext.length }} / {{ AI_CONTEXT_MAX_LENGTH }}
              </span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              v-if="mode === MODE.REWRITE"
              icon="pi pi-sparkles"
              :label="withProgress('Подготовить новое описание', MODE.REWRITE)"
              size="small"
              :loading="jobs[MODE.REWRITE].loading.value"
              :disabled="isContextLoading || aiLoading"
              @click="generate(MODE.REWRITE)"
            />
            <Button
              v-else
              icon="pi pi-sparkles"
              :label="withProgress('Получить рекомендации', MODE.RECOMMEND)"
              size="small"
              :loading="jobs[MODE.RECOMMEND].loading.value"
              :disabled="isContextLoading || aiLoading"
              @click="generate(MODE.RECOMMEND)"
            />
            <PromptLibraryButton
              :key="mode"
              :library="promptLibraries[mode]"
            />
            <Button
              v-tooltip="'Просмотр промпта'"
              size="small"
              severity="secondary"
              icon="pi pi-eye"
              @click="openPromptPreview(mode)"
            />
            <span class="ml-auto text-xs text-surface-400 dark:text-surface-500">
              ≈{{ promptTokenEstimate.toLocaleString('ru') }} ткн.
            </span>
          </div>
        </div>
      </StepPanel>

      <StepPanel
        v-if="mode === MODE.RECOMMEND"
        value="2"
      >
        <div class="flex flex-col gap-4 pt-3">
          <div
            class="pts-ai-result text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-3 max-h-[55vh] overflow-y-auto"
            v-html="renderAiMarkdown(recommendations)"
          />

          <div class="flex flex-col gap-1">
            <label
              for="improve-description-answers"
              class="text-sm font-medium"
            >Ответы на вопросы и пояснения</label>
            <Textarea
              id="improve-description-answers"
              v-model="answers"
              rows="5"
              fluid
              auto-resize
              placeholder="1. …&#10;2. …&#10;Можно ответить не на все — неотвеченное останется в описании открытым вопросом или пометкой «уточнить»."
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              label="Назад"
              icon="pi pi-arrow-left"
              severity="secondary"
              variant="text"
              size="small"
              @click="activeStep = '1'"
            />
            <Button
              label="Заново"
              icon="pi pi-refresh"
              severity="secondary"
              size="small"
              :disabled="aiLoading"
              @click="generate(MODE.RECOMMEND)"
            />
            <Button
              icon="pi pi-sparkles"
              :label="withProgress('Подготовить новое описание', MODE.REWRITE)"
              size="small"
              :loading="jobs[MODE.REWRITE].loading.value"
              :disabled="aiLoading && !jobs[MODE.REWRITE].loading.value"
              @click="generate(MODE.REWRITE)"
            />
            <PromptLibraryButton :library="promptLibraries[ANSWERS_PROMPT]" />
            <Button
              v-tooltip="'Просмотр промпта нового описания'"
              size="small"
              severity="secondary"
              icon="pi pi-eye"
              @click="openPromptPreview(MODE.REWRITE)"
            />
          </div>
        </div>
      </StepPanel>

      <StepPanel :value="resultStep">
        <div class="flex flex-col gap-3 pt-3">
          <SelectButton
            :model-value="resultView"
            :options="RESULT_VIEW_OPTIONS"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            size="small"
            @update:model-value="changeResultView"
          />

          <BbcodeEditor
            v-if="resultView === 'editor'"
            ref="descriptionEditor"
            v-model="newDescription"
            :files="[...editorFiles, ...attachments.imageInfos.value]"
            :upload-image="attachments.uploadImage"
            :disabled="applied"
            :min-height="200"
            :max-height="500"
          />
          <BbcodeEditor
            v-else-if="resultView === 'bbcode'"
            ref="descriptionEditor"
            v-model="newDescription"
            plain
            :rows="16"
            input-class="font-mono text-xs"
            :upload-image="attachments.uploadImage"
            :disabled="applied"
          />
          <div
            v-else
            class="pts-ai-result text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-3 max-h-[55vh] overflow-y-auto"
            v-html="renderBbcode(applied ? backup?.description ?? '' : context.description) || 'Описание было пустым'"
          />

          <EditorAttachments
            v-if="resultView !== 'before' && !applied"
            v-model:text="newDescription"
            :attachments="attachments"
            :editor="descriptionEditor"
          />

          <Message
            v-if="lostFileTags.length && !applied"
            severity="warn"
            size="small"
            :closable="false"
          >
            Нейросеть убрала из текста вставленные файлы ({{ lostFileTags.length }}) — при замене они будут добавлены в конец описания.
          </Message>

          <Message
            v-if="applied"
            severity="success"
            size="small"
            :closable="false"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span>Описание задачи заменено.</span>
              <Button
                label="Обновить страницу"
                icon="pi pi-refresh"
                size="small"
                severity="secondary"
                @click="reloadPage"
              />
              <Button
                label="Откатить"
                icon="pi pi-undo"
                size="small"
                severity="secondary"
                variant="text"
                :loading="rollingBack"
                @click="rollback"
              />
            </div>
          </Message>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              label="Назад"
              icon="pi pi-arrow-left"
              severity="secondary"
              variant="text"
              size="small"
              :disabled="applied"
              @click="activeStep = mode === MODE.RECOMMEND ? '2' : '1'"
            />
            <Button
              label="Заново"
              icon="pi pi-refresh"
              severity="secondary"
              size="small"
              :loading="jobs[MODE.REWRITE].loading.value"
              :disabled="applied || aiLoading"
              @click="generate(MODE.REWRITE)"
            />
            <Button
              v-tooltip.top="'Скачать текущее описание задачи в BBCode — на случай, если захочется вернуть его вручную'"
              label="Старое описание .txt"
              icon="pi pi-download"
              severity="secondary"
              variant="text"
              size="small"
              @click="downloadDescription(applied ? backup?.description ?? '' : context.description, 'before-ai')"
            />
            <Button
              v-if="!applied"
              class="ml-auto"
              label="Заменить описание задачи"
              icon="pi pi-check"
              size="small"
              :loading="applying"
              :disabled="aiLoading || !finalDescription || isUploadingFiles"
              @click="applyDescription"
            />
          </div>
        </div>
      </StepPanel>
    </StepPanels>
  </Stepper>

  <Dialog
    v-model:visible="isPromptPreviewOpened"
    :header="getPromptLibrary(previewPromptMode).activePrompt.value ? `Промпт: ${getPromptLibrary(previewPromptMode).activePrompt.value.name}` : 'Промпт'"
    dismissable-mask
    modal
    :style="{ width: '760px' }"
  >
    <pre class="m-0 text-xs font-mono whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto">{{ previewPrompt }}</pre>
    <div class="text-right text-xs text-surface-400 dark:text-surface-500 mt-2">
      {{ previewPrompt.length.toLocaleString('ru') }} символов / ≈{{ previewTokenEstimate.toLocaleString('ru') }} ткн.
    </div>
  </Dialog>

  <AiApiKeyDialog
    v-model:visible="isApiKeyDialogOpened"
    @saved="onApiKeySaved"
  />
</template>
