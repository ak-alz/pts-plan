<script setup>
import dayjs from 'dayjs';
import { Button, Checkbox, Dialog, Message, SelectButton, Skeleton, Step, StepList, StepPanel, StepPanels, Stepper, Textarea } from 'primevue';
import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { useAiJob } from '../../../composables/useAiJob.js';
import { usePromptLibrary } from '../../../composables/usePromptLibrary.js';
import { AI_CODE_FENCE_RE, DISK_FILE_INLINE_RE } from '../../../patterns.js';
import { PixelToolsApi } from '../../../PixelToolsApi.js';
import { renderAiMarkdown } from '../../../renderAiMarkdown.js';
import { showToast } from '../../../toastHost/showToast.js';
import AiApiKeyDialog from '../../../ui/AiApiKeyDialog.vue';
import PromptLibraryButton from '../../../ui/PromptLibraryButton.vue';
import { bbcodeToMarkdown, downloadBlob, estimateTokenCount, isSystemComment } from '../../../utils.js';
import { buildPrompt, buildRecommendationsSection, buildTaskBlock } from '../buildPrompt.js';
import { PROMPT_SPECS } from '../promptSpec.js';
import {
  AI_CONTEXT_MAX_LENGTH,
  CONTEXT_PARTS,
  getAiContextStorageKey,
  getAiJobStorageKey,
  getBackupStorageKey,
  MAX_PROMPT_LENGTH,
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
  comments: null,
  subtasks: null,
  parent: null,
});
// Части контекста, которые грузятся лениво — только когда их галка включена
const loadingParts = reactive({ comments: false, subtasks: false, parent: false });

/* Настройки: режим и состав контекста */
const mode = ref(MODE.REWRITE);
const include = reactive(Object.fromEntries(CONTEXT_PARTS.map((part) => [part.key, part.default])));
let settingsLoaded = false;

watch([mode, include], () => {
  if (!settingsLoaded) return;
  chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: { mode: mode.value, include: { ...toRaw(include) } },
  });
}, { deep: true });

const promptLibraries = {
  [MODE.REWRITE]: usePromptLibrary(PROMPT_SPECS[MODE.REWRITE]),
  [MODE.RECOMMEND]: usePromptLibrary(PROMPT_SPECS[MODE.RECOMMEND]),
};
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
const resultView = ref('preview');
const RESULT_VIEW_OPTIONS = [
  { label: 'Предпросмотр', value: 'preview' },
  { label: 'BBCode', value: 'bbcode' },
  { label: 'Было', value: 'before' },
];

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

const PART_LOADERS = {
  async comments() {
    const comments = await bitrixApi.getComments(props.taskId);
    context.comments = comments.filter((comment) => !isSystemComment(comment));
  },
  async subtasks() {
    const subtasks = await bitrixApi.searchTasks({ parentIds: [props.taskId], selectFields: ['ID', 'TITLE', 'STATUS'] });
    context.subtasks = subtasks.map((subtask) => ({ title: subtask.title, status: String(subtask.status ?? '') }));
  },
  async parent() {
    if (!context.parentId) return;
    const { data } = await bitrixApi.getTask(context.parentId, ['TITLE', 'DESCRIPTION']);
    const parent = data?.result?.task;
    context.parent = parent ? { title: parent.title ?? '', description: parent.description ?? '' } : null;
  },
};

function isPartLoaded(key) {
  return key === 'parent' ? context.parent !== null || !context.parentId : context[key] !== null;
}

async function loadPart(key) {
  if (loadingParts[key] || isPartLoaded(key)) return;
  loadingParts[key] = true;
  try {
    await PART_LOADERS[key]();
  } catch (error) {
    console.warn(error);
    include[key] = false;
    showToast({ severity: 'warn', summary: 'Контекст для ИИ', detail: 'Не удалось загрузить часть данных задачи — она отключена.', life: 5000 });
  } finally {
    loadingParts[key] = false;
  }
}

function loadEnabledParts() {
  return Promise.all(Object.keys(PART_LOADERS).filter((key) => include[key]).map(loadPart));
}

watch(() => ({ ...include }), () => {
  if (!loading.value) loadEnabledParts();
});

/* Промпт */
const taskBlock = computed(() => buildTaskBlock(context, include));

function getPrompt(promptMode) {
  const values = {
    taskData: taskBlock.value,
    extraContext: aiContext.value,
    // Второй этап: переписываем с учётом рекомендаций и ответов пользователя
    recommendationsSection: promptMode === MODE.REWRITE && mode.value === MODE.RECOMMEND
      ? buildRecommendationsSection(recommendations.value, answers.value)
      : '',
  };
  return promptLibraries[promptMode].buildActivePrompt(values) ?? buildPrompt({ mode: promptMode, ...values });
}

const previewPrompt = computed(() => getPrompt(mode.value));

const promptTokenEstimate = computed(() => estimateTokenCount(previewPrompt.value));

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
    await Promise.all([loadEnabledParts(), promptLibraries[promptMode].ready]);

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
  resultView.value = 'preview';
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
const lostFileTags = computed(() => {
  const before = context.description.match(DISK_FILE_INLINE_RE) ?? [];
  return [...new Set(before)].filter((tag) => !newDescription.value.includes(tag));
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
    const previousDescription = context.description;
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
    }
    backup.value = stored[getBackupStorageKey(props.taskId)] ?? null;
    settingsLoaded = true;

    await loadTask();

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
              Нейросеть сразу перепишет описание. Перед заменой вы увидите результат и сможете его поправить.
            </template>
            <template v-else>
              Сначала нейросеть подскажет, чего не хватает в описании, и задаст вопросы. Ответьте на них — и она перепишет описание с учётом ответов.
            </template>
          </p>

          <div class="flex flex-col gap-2">
            <span class="text-sm font-medium">Что передать нейросети</span>
            <span class="text-xs text-surface-500 dark:text-surface-400">Название и текущее описание передаются всегда.</span>
            <div class="grid grid-cols-2 gap-2">
              <template
                v-for="part in CONTEXT_PARTS"
                :key="part.key"
              >
                <div
                  v-if="part.key !== 'parent' || context.parentId"
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
                      v-if="part.key === 'comments' && context.comments"
                      class="text-xs text-surface-400 dark:text-surface-500"
                    >{{ context.comments.length }}</span>
                    <span
                      v-if="part.key === 'subtasks' && context.subtasks"
                      class="text-xs text-surface-400 dark:text-surface-500"
                    >{{ context.subtasks.length }}</span>
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
              :label="withProgress('Переписать описание', MODE.REWRITE)"
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
              @click="isPromptPreviewOpened = true"
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
              placeholder="1. …&#10;2. …&#10;Можно ответить не на все — неотвеченные вопросы останутся в описании как открытые."
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
              :label="withProgress('Сгенерировать новое описание', MODE.REWRITE)"
              size="small"
              :loading="jobs[MODE.REWRITE].loading.value"
              :disabled="aiLoading && !jobs[MODE.REWRITE].loading.value"
              @click="generate(MODE.REWRITE)"
            />
          </div>
        </div>
      </StepPanel>

      <StepPanel :value="resultStep">
        <div class="flex flex-col gap-3 pt-3">
          <SelectButton
            v-model="resultView"
            :options="RESULT_VIEW_OPTIONS"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            size="small"
          />

          <div
            v-if="resultView === 'preview'"
            class="pts-ai-result text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-3 max-h-[55vh] overflow-y-auto"
            v-html="renderBbcode(finalDescription)"
          />
          <Textarea
            v-else-if="resultView === 'bbcode'"
            v-model="newDescription"
            rows="16"
            fluid
            class="font-mono text-xs"
            spellcheck="false"
            :disabled="applied"
          />
          <div
            v-else
            class="pts-ai-result text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-3 max-h-[55vh] overflow-y-auto"
            v-html="renderBbcode(applied ? backup?.description ?? '' : context.description) || 'Описание было пустым'"
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
              :disabled="aiLoading || !finalDescription"
              @click="applyDescription"
            />
          </div>
        </div>
      </StepPanel>
    </StepPanels>
  </Stepper>

  <Dialog
    v-model:visible="isPromptPreviewOpened"
    :header="promptLibraries[mode].activePrompt.value ? `Промпт: ${promptLibraries[mode].activePrompt.value.name}` : 'Промпт'"
    dismissable-mask
    modal
    :style="{ width: '760px' }"
  >
    <pre class="m-0 text-xs font-mono whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto">{{ previewPrompt }}</pre>
    <div class="text-right text-xs text-surface-400 dark:text-surface-500 mt-2">
      {{ previewPrompt.length.toLocaleString('ru') }} символов / ≈{{ promptTokenEstimate.toLocaleString('ru') }} ткн.
    </div>
  </Dialog>

  <AiApiKeyDialog
    v-model:visible="isApiKeyDialogOpened"
    @saved="onApiKeySaved"
  />
</template>
