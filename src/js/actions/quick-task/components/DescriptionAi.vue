<script setup>
import {Button, Dialog, Textarea} from 'primevue';
import {computed, onMounted, onUnmounted, ref, watch} from 'vue';

import {useAiJob} from '../../../composables/useAiJob.js';
import {usePromptLibrary} from '../../../composables/usePromptLibrary.js';
import {AI_CODE_FENCE_RE} from '../../../patterns.js';
import {PixelToolsApi} from '../../../PixelToolsApi.js';
import AiApiKeyDialog from '../../../ui/AiApiKeyDialog.vue';
import PromptLibraryButton from '../../../ui/PromptLibraryButton.vue';
import {estimateTokenCount} from '../../../utils.js';
import {buildPrompt, buildTaskBlock} from '../buildPrompt.js';
import {PROMPT_SPEC} from '../promptSpec.js';

const props = defineProps({
  // Ключ доски: контекст для ИИ хранится отдельно для каждого канбана
  boardKey: {type: String, required: true},
  title: {type: String, default: ''},
  projectName: {type: String, default: ''},
  stageName: {type: String, default: ''},
  responsibleName: {type: String, default: ''},
  // Забирает из редактора самый свежий текст описания перед генерацией
  syncDescription: {type: Function, default: null},
});

const description = defineModel('description', {type: String, default: ''});
// Идёт ли генерация — пока да, форма блокирует поле описания: ответ его целиком заменит
const generating = defineModel('generating', {type: Boolean, default: false});

const AI_CONTEXT_MAX_LENGTH = 1000;

const aiContextStorageKey = computed(() => `quick-task-ai-context-${props.boardKey}`);
const aiContext = ref('');
const isContextOpened = ref(false);
const isPromptPreviewOpened = ref(false);
const isApiKeyDialogOpened = ref(false);
// Описание до генерации — чтобы вернуть его, если результат не понравился
const previousDescription = ref(null);

const promptLibrary = usePromptLibrary(PROMPT_SPEC);
// Ключ генерации — свой у каждого открытия окна. Прерванную генерацию не подхватываем: окно каждый
// раз открывается для новой задачи, и ответ, начатый для прошлой, подставился бы в чужую форму
const jobKey = `quick-task-ai-job-${crypto.randomUUID()}`;
const job = useAiJob(() => jobKey, {onAuthError: openApiKeyDialog});
let isUnmounted = false;

watch(job.loading, (loading) => {
  generating.value = loading;
});

const buttonLabel = computed(() => (job.loading.value && job.progress.value !== null
  ? `Сгенерировать описание (${job.progress.value}%)`
  : 'Сгенерировать описание'));

function getPrompt() {
  const values = {
    taskData: buildTaskBlock({
      title: props.title.trim(),
      description: description.value,
      projectName: props.projectName,
      stageName: props.stageName,
      responsibleName: props.responsibleName,
    }),
    extraContext: aiContext.value,
  };
  return promptLibrary.buildActivePrompt(values) ?? buildPrompt(values);
}

const previewPrompt = computed(() => getPrompt());
const promptTokenEstimate = computed(() => estimateTokenCount(previewPrompt.value));

function openApiKeyDialog() {
  isApiKeyDialogOpened.value = true;
}

async function onAiContextInput(event) {
  aiContext.value = event.target.value.slice(0, AI_CONTEXT_MAX_LENGTH);
  await chrome.storage.local.set({[aiContextStorageKey.value]: aiContext.value});
}

function applyResult(result) {
  previousDescription.value = description.value;
  description.value = result.replace(AI_CODE_FENCE_RE, '').trim();
}

function restorePrevious() {
  description.value = previousDescription.value ?? '';
  previousDescription.value = null;
}

async function generate() {
  const apiKey = await job.getApiKey();
  if (!apiKey) {
    openApiKeyDialog();
    return;
  }

  const {onStart, onProgress} = job.chatCallbacks();
  await job.runJob(async () => {
    await Promise.all([promptLibrary.ready, props.syncDescription?.()]);
    // Окно закрыли до ответа — useAiJob оставил бы запись генерации в хранилище навсегда, ведь
    // подхватывать её некому
    return new PixelToolsApi(apiKey).chat(getPrompt(), '', onProgress, onStart)
      .finally(() => { if (isUnmounted) job.forget(); });
  }, applyResult);
}

onMounted(async () => {
  const stored = await chrome.storage.local.get([aiContextStorageKey.value]);
  aiContext.value = stored[aiContextStorageKey.value] ?? '';
});

onUnmounted(() => {
  isUnmounted = true;
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <Button
        v-tooltip.top="title.trim() ? null : 'Сначала введите название задачи'"
        icon="pi pi-sparkles"
        :label="buttonLabel"
        size="small"
        severity="secondary"
        :loading="job.loading.value"
        :disabled="!title.trim() || job.loading.value"
        @click="generate"
      />
      <Button
        v-tooltip.top="'Контекст для ИИ: проект, стек, договорённости — запоминается для этой доски'"
        icon="pi pi-align-left"
        :label="aiContext ? 'Контекст ✓' : 'Контекст'"
        size="small"
        severity="secondary"
        variant="text"
        @click="isContextOpened = !isContextOpened"
      />
      <PromptLibraryButton :library="promptLibrary" />
      <Button
        v-tooltip.top="'Просмотр промпта'"
        icon="pi pi-eye"
        size="small"
        severity="secondary"
        @click="isPromptPreviewOpened = true"
      />
      <Button
        v-if="previousDescription !== null && !job.loading.value"
        icon="pi pi-undo"
        label="Вернуть как было"
        size="small"
        severity="secondary"
        variant="text"
        @click="restorePrevious"
      />
    </div>
    <span class="text-xs text-surface-500 dark:text-surface-400">
      Нейросеть заполнит описание по названию. Если в поле уже есть шаблон или черновик — она сохранит его структуру и дополнит, а чего не знает — отметит «уточнить».
    </span>

    <div
      v-if="isContextOpened"
      class="relative"
    >
      <Textarea
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

  <Dialog
    v-model:visible="isPromptPreviewOpened"
    :header="promptLibrary.activePrompt.value ? `Промпт: ${promptLibrary.activePrompt.value.name}` : 'Промпт'"
    dismissable-mask
    modal
    class="w-[760px]"
  >
    <pre class="m-0 text-xs font-mono whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto">{{ previewPrompt }}</pre>
    <div class="text-right text-xs text-surface-400 dark:text-surface-500 mt-2">
      {{ previewPrompt.length.toLocaleString('ru') }} символов / ≈{{ promptTokenEstimate.toLocaleString('ru') }} ткн.
    </div>
  </Dialog>

  <AiApiKeyDialog
    v-model:visible="isApiKeyDialogOpened"
    @saved="generate"
  />
</template>
