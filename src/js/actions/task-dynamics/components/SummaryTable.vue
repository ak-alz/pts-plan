<script setup>
import dayjs from 'dayjs';
import {Button, Column, DataTable, Dialog, InputGroup, Password, Skeleton, Textarea} from 'primevue';
import {computed, nextTick, onMounted, ref} from 'vue';

import {useAiJob} from '../../../composables/useAiJob.js';
import {PixelToolsApi} from '../../../PixelToolsApi.js';
import {renderAiMarkdown} from '../../../renderAiMarkdown.js';
import {showToast} from '../../../toastHost/showToast.js';
import {estimateTokenCount, pluralize} from '../../../utils.js';
import {buildPromptPreview, buildSystemPrompt} from '../buildSystemPrompt.js';
import {CUT_OPTIONS, STALE_DAYS, SUMMARY_METRICS} from '../variables.js';
import ExportButtons from './ExportButtons.vue';

const props = defineProps({
  summary: {
    type: Object,
    required: true,
  },
  compareSummary: {
    type: Object,
    default: null,
  },
  backlog: {
    type: Object,
    default: null,
  },
  snapshotAt: {
    type: String,
    default: null,
  },
  snapshotLoading: {
    type: Boolean,
    default: false,
  },
  milestoneComparison: {
    type: Object,
    default: null,
  },
  bucketRows: {
    type: Array,
    default: () => [],
  },
  milestones: {
    type: Array,
    default: () => [],
  },
  groupId: {
    type: String,
    required: true,
  },
  dateRange: {
    type: Array,
    default: null,
  },
  compareDateRange: {
    type: Array,
    default: null,
  },
  cut: {
    type: String,
    default: 'all',
  },
  copySeparator: {
    type: String,
    default: '\t',
  },
  csvSeparator: {
    type: String,
    default: ',',
  },
});

function formatMetric(value, format) {
  if (value === null || value === undefined) return '—';
  if (format === 'percent') return `${value}%`;
  if (format === 'days') return `${value} дн.`;
  return String(value);
}

function computeDelta(current, compare) {
  if (compare === null || compare === undefined) return null;
  if (current === null || current === undefined) return null;
  return Math.round((current - compare) * 10) / 10;
}

const metricRows = computed(() => SUMMARY_METRICS.map((metric) => {
  const value = props.summary[metric.key];
  const compareValue = props.compareSummary ? props.compareSummary[metric.key] : null;
  return {
    ...metric,
    value,
    compareValue,
    delta: props.compareSummary ? computeDelta(value, compareValue) : null,
    valueLabel: formatMetric(value, metric.format),
    compareLabel: formatMetric(compareValue, metric.format),
  };
}));

const milestoneRows = computed(() => {
  if (!props.milestoneComparison) return [];
  const {before, after} = props.milestoneComparison;
  return SUMMARY_METRICS.map((metric) => ({
    ...metric,
    beforeLabel: formatMetric(before[metric.key], metric.format),
    afterLabel: formatMetric(after[metric.key], metric.format),
    delta: computeDelta(after[metric.key], before[metric.key]),
  }));
});

/** Плюс — зелёный, минус — красный; у метрик «меньше значит лучше» цвета меняются местами. */
function deltaClass(delta, lowerIsBetter) {
  if (delta === null || delta === 0) return 'text-surface-400 dark:text-surface-500';
  const isGood = lowerIsBetter ? delta < 0 : delta > 0;
  return isGood ? 'text-green-400' : 'text-red-400';
}

function formatDelta(delta, format) {
  if (delta === null) return '';
  const sign = delta > 0 ? '+' : '';
  if (format === 'percent') return `${sign}${delta} п.п.`;
  if (format === 'days') return `${sign}${delta} дн.`;
  return `${sign}${delta}`;
}

const exportHeaders = computed(() => {
  const headers = ['Метрика', 'Значение'];
  if (props.compareSummary) headers.push('Сравнительный период', 'Дельта');
  return headers;
});

const exportRows = computed(() => metricRows.value.map((row) => {
  const cells = [row.label, row.valueLabel];
  if (props.compareSummary) cells.push(row.compareLabel, formatDelta(row.delta, row.format));
  return cells;
}));

const othersNote = computed(() => {
  const others = props.summary.team?.others;
  if (!others?.count) return null;
  return `Прочие исполнители (ниже порога вклада): ${others.count} `
    + `${pluralize(others.count, ['человек', 'человека', 'человек'])}, ${others.closed} `
    + `${pluralize(others.closed, ['задача', 'задачи', 'задач'])}, ${others.points} `
    + `${pluralize(others.points, ['балл', 'балла', 'баллов'])}.`;
});

const AI_CONTEXT_MAX_LENGTH = 1000;
const aiContextStorageKey = computed(() => `task-dynamics-ai-context-${props.groupId}`);
const aiContext = ref('');
const isAiContextModalOpened = ref(false);
const isPromptPreviewModalOpened = ref(false);
const isApiKeyModalOpened = ref(false);
const apiKeyInputValue = ref('');
const aiResult = ref('');
const aiResultHtml = computed(() => renderAiMarkdown(aiResult.value));
const aiResultElement = ref(null);

function buildAiSummaryEntry(metrics, compare) {
  const entry = {};
  SUMMARY_METRICS.forEach((metric) => {
    entry[metric.label] = metrics[metric.key];
    if (compare) {
      const delta = computeDelta(metrics[metric.key], compare[metric.key]);
      if (delta !== null) entry[`${metric.label} — дельта`] = delta;
    }
  });
  return entry;
}

function buildAiData() {
  return {
    период: props.dateRange
      ? `${dayjs(props.dateRange[0]).format('DD.MM.YYYY')} — ${dayjs(props.dateRange[1]).format('DD.MM.YYYY')}`
      : null,
    сравнительный_период: props.compareDateRange
      ? `${dayjs(props.compareDateRange[0]).format('DD.MM.YYYY')} — ${dayjs(props.compareDateRange[1]).format('DD.MM.YYYY')}`
      : null,
    разрез: CUT_OPTIONS.find((option) => option.value === props.cut)?.label ?? props.cut,
    сводка: buildAiSummaryEntry(props.summary, props.compareSummary),
    срез_сейчас: props.backlog
      ? {
        в_планах: props.backlog.backlog.total,
        без_движения_дольше_90_дней: props.backlog.backlog.staleCount,
        медианный_возраст_в_планах_дней: props.backlog.backlog.medianAge,
        взято_в_текущий_спринт: props.backlog.sprint.total,
        исключено_из_расчётов: props.backlog.excluded.total,
      }
      : null,
    события: props.milestones.map((milestone) => `${milestone.date}: ${milestone.label}`),
    бакеты: props.bucketRows.map((row) => ({
      бакет: row.label,
      создано: row.created,
      закрыто: row.closed,
      накопленный_долг: row.cumulativeDebt,
      баллы: row.points,
      активных_исполнителей: row.activeUsers,
      баллов_на_человека: row.pointsPerActiveUser,
      хотфиксов: row.hotfixes,
      доля_хотфиксов: row.hotfixShare,
      медиана_времени_дней: row.leadTimeMedian,
      перцентиль_85_дней: row.leadTimeP85,
      задач_на_корневую: row.subtasksPerRoot,
      средний_размер_задачи: row.avgPointsPerTask,
    })),
    ...(props.milestoneComparison
      ? {
        сравнение_по_событию: {
          событие: `${props.milestoneComparison.date}: ${props.milestoneComparison.label}`,
          до: buildAiSummaryEntry(props.milestoneComparison.before),
          после: buildAiSummaryEntry(props.milestoneComparison.after),
        },
      }
      : {}),
  };
}

const promptPreview = computed(() => buildPromptPreview(props.dateRange, props.compareDateRange, aiContext.value.trim() || null));
// Длину и токены считаем по тексту без разметки: в предпросмотре подставляемые значения обёрнуты
// в теги для подсветки, а в сам запрос уходит только текст — иначе оценка завышена вдвое
const promptPreviewText = computed(() => new DOMParser()
  .parseFromString(promptPreview.value, 'text/html').body.textContent ?? '');
const promptTokens = computed(() => estimateTokenCount(promptPreviewText.value));

const aiJob = useAiJob(() => `task-dynamics-ai-job-${props.groupId}`, {
  onAuthError: () => { isApiKeyModalOpened.value = true; },
});
const aiLoading = aiJob.loading;
const aiProgress = aiJob.progress;
const aiButtonLabel = computed(() => (aiLoading.value && aiProgress.value !== null ? `AI анализ (${aiProgress.value}%)` : 'AI анализ'));

async function onAiContextInput(event) {
  aiContext.value = event.target.value.slice(0, AI_CONTEXT_MAX_LENGTH);
  await chrome.storage.local.set({[aiContextStorageKey.value]: aiContext.value});
}

async function scrollToAiResult() {
  await nextTick();
  aiResultElement.value?.scrollIntoView({behavior: 'smooth', block: 'start'});
}

async function aiAnalyze() {
  const apiKey = await aiJob.getApiKey();
  if (!apiKey) {
    isApiKeyModalOpened.value = true;
    return;
  }

  aiResult.value = '';
  const {onStart, onProgress} = aiJob.chatCallbacks();
  await aiJob.runJob(() => {
    const MAX_PROMPT_LENGTH = 30000;
    let prompt = buildSystemPrompt(buildAiData(), {
      dateRange: props.dateRange,
      compareDateRange: props.compareDateRange,
      extraContext: aiContext.value,
    });
    if (prompt.length > MAX_PROMPT_LENGTH) {
      prompt = prompt.slice(0, MAX_PROMPT_LENGTH);
      showToast({
        severity: 'warn',
        summary: 'AI',
        detail: `Данные обрезаны — запрос превышал ${MAX_PROMPT_LENGTH} символов. Сократите период или укрупните бакет.`,
        life: 5000,
      });
    }
    return new PixelToolsApi(apiKey).chat(prompt, '', onProgress, onStart);
  }, async (result) => {
    aiResult.value = result;
    await scrollToAiResult();
  });
}

async function resumeAiAnalyze(reportId, initialProgress) {
  const apiKey = await aiJob.getApiKey();
  if (!apiKey) {
    await aiJob.forget();
    return;
  }
  aiProgress.value = initialProgress ?? 1;
  await aiJob.runJob(
    () => new PixelToolsApi(apiKey).resumeChat(reportId, aiJob.resumeProgressCallback(reportId), initialProgress),
    async (result) => {
      aiResult.value = result;
      await scrollToAiResult();
    },
  );
}

async function saveApiKey() {
  const key = apiKeyInputValue.value.trim();
  if (!key) return;
  const {options} = await chrome.storage.local.get(['options']);
  await chrome.storage.local.set({options: {...(options ?? {}), pixelToolsApiKey: key}});
  isApiKeyModalOpened.value = false;
  await aiAnalyze();
}

onMounted(async () => {
  const stored = await chrome.storage.local.get([aiContextStorageKey.value]);
  if (stored[aiContextStorageKey.value]) aiContext.value = stored[aiContextStorageKey.value];

  const job = await aiJob.getPendingJob();
  if (job?.reportId) resumeAiAnalyze(job.reportId, job.progress);
});
</script>

<template>
  <div class="flex gap-1 justify-between mb-2 flex-wrap">
    <InputGroup :pt="{root: {style: {width: 'auto'}}}">
      <Button
        size="small"
        severity="secondary"
        outlined
        icon="pi pi-sparkles"
        :label="aiButtonLabel"
        :loading="aiLoading"
        @click="aiAnalyze"
      />
      <Button
        v-tooltip="'Дополнительный контекст для AI'"
        size="small"
        severity="secondary"
        :icon="aiContext.trim() ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
        @click="isAiContextModalOpened = true"
      />
      <Button
        v-tooltip="'Просмотр запроса к AI'"
        size="small"
        severity="secondary"
        icon="pi pi-eye"
        @click="isPromptPreviewModalOpened = true"
      />
    </InputGroup>
    <ExportButtons
      :headers="exportHeaders"
      :rows="exportRows"
      file-name="task-dynamics-summary.csv"
      :copy-separator="copySeparator"
      :csv-separator="csvSeparator"
    />
  </div>

  <div
    v-if="backlog"
    class="grid grid-cols-4 gap-2 mb-4"
  >
    <div class="rounded border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-2">
      <div class="text-xs text-surface-500 dark:text-surface-400">
        Сейчас в планах
      </div>
      <div class="text-lg font-semibold text-surface-800 dark:text-surface-0">
        {{ backlog.backlog.total }}
      </div>
      <div class="text-xs text-surface-500 dark:text-surface-400">
        медиана возраста — {{ backlog.backlog.medianAge ?? '—' }} дн.
      </div>
    </div>
    <div class="rounded border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-2">
      <div class="text-xs text-surface-500 dark:text-surface-400">
        Без движения дольше {{ STALE_DAYS }} дней
      </div>
      <div class="text-lg font-semibold text-surface-800 dark:text-surface-0">
        {{ backlog.backlog.staleCount }}
      </div>
      <div class="text-xs text-surface-500 dark:text-surface-400">
        лежат мёртвым грузом
      </div>
    </div>
    <div class="rounded border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-2">
      <div class="text-xs text-surface-500 dark:text-surface-400">
        Взято в текущий спринт
      </div>
      <div class="text-lg font-semibold text-surface-800 dark:text-surface-0">
        {{ backlog.sprint.total }}
      </div>
      <div class="text-xs text-surface-500 dark:text-surface-400">
        включая ждущие закрытия
      </div>
    </div>
    <div class="rounded border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-2">
      <div class="text-xs text-surface-500 dark:text-surface-400">
        Исключено из расчётов
      </div>
      <div class="text-lg font-semibold text-surface-800 dark:text-surface-0">
        {{ backlog.excluded.total }}
      </div>
      <div class="text-xs text-surface-500 dark:text-surface-400">
        архивные колонки
      </div>
    </div>
  </div>

  <div
    v-else-if="snapshotLoading"
    class="grid grid-cols-4 gap-2 mb-4"
  >
    <Skeleton
      v-for="index in 4"
      :key="index"
      height="66px"
    />
  </div>

  <DataTable
    :value="metricRows"
    data-key="key"
    row-group-mode="subheader"
    group-rows-by="group"
    size="small"
    striped-rows
    show-gridlines
  >
    <template #groupheader="{data}">
      <span class="font-semibold text-surface-700 dark:text-surface-0">{{ data.group }}</span>
    </template>
    <Column
      field="label"
      header="Метрика"
    >
      <template #body="{data}">
        <span class="inline-flex items-center gap-1">
          {{ data.label }}
          <i
            v-tooltip="data.tip"
            class="pi pi-question-circle text-surface-400 dark:text-surface-500"
          />
        </span>
      </template>
    </Column>
    <Column header="Значение">
      <template #body="{data}">
        <b>{{ data.valueLabel }}</b>
        <span
          v-if="data.delta !== null"
          class="text-sm ml-1"
          :class="deltaClass(data.delta, data.lowerIsBetter)"
        >{{ formatDelta(data.delta, data.format) }}</span>
      </template>
    </Column>
    <Column
      v-if="compareSummary"
      header="Сравнительный период"
    >
      <template #body="{data}">
        <span class="text-surface-500 dark:text-surface-400">{{ data.compareLabel }}</span>
      </template>
    </Column>

    <template #empty>
      Нет данных
    </template>
  </DataTable>

  <p
    v-if="othersNote"
    class="text-xs text-surface-500 dark:text-surface-400 mt-2"
  >
    {{ othersNote }}
    <template v-if="summary.team?.excluded?.count">
      Исключено вручную: {{ summary.team.excluded.count }} — их задачи и баллы в командные метрики не входят.
    </template>
  </p>
  <p
    v-if="!compareSummary"
    class="text-xs text-surface-500 dark:text-surface-400 mt-2"
  >
    Сравнительный период не выбран — дельты не показываются.
  </p>

  <template v-if="milestoneComparison">
    <div class="text-sm font-semibold text-surface-700 dark:text-surface-0 mt-5 mb-2">
      До и после события «{{ milestoneComparison.label }}» ({{ dayjs(milestoneComparison.date).format('DD.MM.YYYY') }})
    </div>
    <DataTable
      :value="milestoneRows"
      data-key="key"
      row-group-mode="subheader"
      group-rows-by="group"
      size="small"
      striped-rows
      show-gridlines
    >
      <template #groupheader="{data}">
        <span class="font-semibold text-surface-700 dark:text-surface-0">{{ data.group }}</span>
      </template>
      <Column
        field="label"
        header="Метрика"
      />
      <Column header="До">
        <template #body="{data}">
          <span class="text-surface-500 dark:text-surface-400">{{ data.beforeLabel }}</span>
        </template>
      </Column>
      <Column header="После">
        <template #body="{data}">
          <b>{{ data.afterLabel }}</b>
          <span
            v-if="data.delta !== null"
            class="text-sm ml-1"
            :class="deltaClass(data.delta, data.lowerIsBetter)"
          >{{ formatDelta(data.delta, data.format) }}</span>
        </template>
      </Column>

      <template #empty>
        Нет данных
      </template>
    </DataTable>
    <p class="text-xs text-surface-500 dark:text-surface-400 mt-2">
      «До» — от начала периода до дня события, «После» — от дня события до конца периода. Части периода могут быть
      разной длины, поэтому сравнивайте в первую очередь метрики «в месяц», доли и медианы.
    </p>
  </template>

  <div
    v-if="aiResult"
    ref="aiResultElement"
    class="mt-4 max-w-[1000px]"
  >
    <div class="flex items-center gap-1 mb-2 text-sm text-surface-400 dark:text-surface-500">
      <i class="pi pi-sparkles" />
      <span>Результат AI анализа</span>
    </div>
    <div
      class="pts-ai-result p-3 rounded border border-surface-200 dark:border-surface-700 text-sm leading-relaxed"
      v-html="aiResultHtml"
    />
  </div>

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
    header="Дополнительный контекст для AI"
    dismissable-mask
    modal
    :style="{width: '480px'}"
  >
    <p class="text-sm text-surface-500 dark:text-surface-400 mb-3">
      Что стоит учесть при анализе: как устроен процесс команды, что менялось в периоде, чего в данных нет.
    </p>
    <div class="relative">
      <Textarea
        :value="aiContext"
        :maxlength="AI_CONTEXT_MAX_LENGTH"
        rows="6"
        fluid
        placeholder="Например: спринт — неделя, итоги подводим в четверг, в марте наняли двух разработчиков, в мае начали использовать AI-агентов..."
        @input="onAiContextInput"
      />
      <span class="absolute bottom-2 right-2 text-xs text-surface-400 dark:text-surface-500 pointer-events-none">
        {{ aiContext.length }} / {{ AI_CONTEXT_MAX_LENGTH }}
      </span>
    </div>
  </Dialog>

  <Dialog
    v-model:visible="isPromptPreviewModalOpened"
    header="Запрос к AI"
    dismissable-mask
    modal
    :style="{width: '760px'}"
  >
    <pre
      class="text-xs font-mono whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto overflow-x-hidden"
      v-html="promptPreview"
    />
    <div class="text-right text-xs text-surface-400 dark:text-surface-500 mt-2">
      {{ promptPreviewText.length }} символов, примерно {{ promptTokens }} токенов
    </div>
  </Dialog>
</template>
