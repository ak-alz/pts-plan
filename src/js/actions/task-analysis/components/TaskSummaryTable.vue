<script setup>
import {marked} from 'marked';
import {Button, Column, DataTable, Dialog, InputGroup, Password, Textarea} from 'primevue';
import {useToast} from 'primevue/usetoast';
import {computed, nextTick, onMounted, ref} from 'vue';

import {useAiJob} from '../../../composables/useAiJob.js';
import {PixelToolsApi} from '../../../PixelToolsApi.js';
import {colors} from '../../../utils.js';
import {buildPromptPreview, buildSystemPrompt} from '../buildSystemPrompt.js';

const props = defineProps({
  rows: {
    type: Array,
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
  dateRange: {
    type: Array,
    default: null,
  },
  multiUser: {
    type: Boolean,
    default: false,
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

const indigoShades = Object.values(colors.indigo);

const pointColorMap = computed(() => {
  const allPoints = [...new Set(
    props.rows.flatMap((row) => [
      ...row.pointDistribution.map((s) => s.points),
      ...(row.prevPointDistribution ?? []).map((s) => s.points),
    ]),
  )].sort((a, b) => a - b);
  return new Map(allPoints.map((p, i) => [p, indigoShades[i % indigoShades.length]]));
});

function getPointColor(points) {
  return pointColorMap.value.get(points);
}

function buildDistTooltip(dist, prevDist) {
  if (!prevDist) {
    return {
      value: dist.map((s) => `${s.points}: ${s.count} (${s.pct}%)`).join('\n'),
      pt: {text: {style: {whiteSpace: 'pre'}}},
    };
  }
  const prevMap = new Map(prevDist.map((s) => [s.points, s]));
  const allPoints = [...new Set([...dist.map((s) => s.points), ...prevDist.map((s) => s.points)])].sort((a, b) => a - b);
  const lines = allPoints.map((pts) => {
    const cur = dist.find((s) => s.points === pts);
    const prev = prevMap.get(pts);
    const curPct = cur?.pct ?? 0;
    const prevPct = prev?.pct ?? 0;
    const delta = curPct - prevPct;
    const deltaStr = delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta}%)` : '';
    return `${pts}б: ${curPct}%${deltaStr}`;
  });
  return {
    value: lines.join('\n'),
    pt: {text: {style: {whiteSpace: 'pre'}}},
  };
}

function buildRows() {
  const headers = [];
  if (props.multiUser) headers.push('Исполнитель');
  headers.push('Баллов всего', 'Задач всего', 'Корневые', 'Коэф. декомп.', 'Средний балл / задачу', 'Средний балл / мес.');
  headers.push('Распределение');
  const hasPrevDist = props.rows.some((r) => r.prevPointDistribution != null);
  if (hasPrevDist) headers.push('Распределение (пред.)');

  const dataRows = props.rows.map((row) => {
    const cells = [];
    if (props.multiUser) cells.push(row.userName);
    cells.push(row.totalPoints, row.totalTasks, row.totalRoots, row.decompRatio, row.avgPointsPerTask, row.avgPoints);
    cells.push(row.pointDistribution.map((s) => `${s.points}: ${s.count} (${s.pct}%)`).join(', '));
    if (hasPrevDist) cells.push(row.prevPointDistribution ? row.prevPointDistribution.map((s) => `${s.points}: ${s.count} (${s.pct}%)`).join(', ') : '');
    return cells;
  });

  return {headers, dataRows};
}

const toast = useToast();

const AI_CONTEXT_MAX_LENGTH = 1000;
const aiContextStorageKey = computed(() => `task-analysis-ai-context-${props.groupId}`);
const aiContext = ref('');
const isAiContextModalOpened = ref(false);
const isPromptPreviewModalOpened = ref(false);

function buildAiData() {
  const periodLabel = 'мес.';
  return props.rows.map((row) => {
    const entry = {
      ...(props.multiUser ? {исполнитель: row.userName} : {}),
      баллов_всего: row.totalPoints,
      задач_всего: row.totalTasks,
      корневые_задачи: row.totalRoots,
      коэф_декомпозиции: row.decompRatio,
      средний_балл_за_задачу: row.avgPointsPerTask,
      [`средний_балл_за_${periodLabel}`]: row.avgPoints,
      распределение: row.pointDistribution.map((s) => `${s.points}б: ${s.count} (${s.pct}%)`).join(', '),
      ...(row.prevPointDistribution ? {распределение_пред_период: row.prevPointDistribution.map((s) => `${s.points}б: ${s.count} (${s.pct}%)`).join(', ')} : {}),
      топ_задач: row.topTasks?.map((t) => `${t.title} (${t.points}б)`),
    };
    if (row.deltaTotal !== null) {
      entry.дельта_баллов = row.deltaTotal;
      entry.дельта_задач = row.deltaTotalTasks;
      entry.дельта_корневых = row.deltaTotalRoots;
      entry.дельта_коэф_декомп = row.deltaDecompRatio;
      entry.дельта_балл_за_задачу = row.deltaAvgPointsPerTask;
      entry[`дельта_балл_за_${periodLabel}`] = row.deltaAvgPoints;
    }
    return entry;
  });
}

const promptPreview = computed(() => buildPromptPreview(props.dateRange, aiContext.value.trim() || null));

async function onAiContextInput(e) {
  aiContext.value = e.target.value.slice(0, AI_CONTEXT_MAX_LENGTH);
  await chrome.storage.local.set({[aiContextStorageKey.value]: aiContext.value});
}

const aiResult = ref('');
const aiResultHtml = computed(() => aiResult.value ? marked(aiResult.value) : '');
const aiResultElement = ref(null);

const isApiKeyModalOpened = ref(false);
const apiKeyInputValue = ref('');

const aiJob = useAiJob(() => `task-analysis-ai-job-${props.groupId}`, {
  group: 'task-analysis',
  onAuthError: () => { isApiKeyModalOpened.value = true; },
});
const aiLoading = aiJob.loading;
const aiProgress = aiJob.progress;
const aiButtonLabel = computed(() => aiLoading.value && aiProgress.value !== null ? `AI анализ (${aiProgress.value}%)` : 'AI анализ');

async function scrollToAiResult() {
  await nextTick();
  aiResultElement.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(async () => {
  const stored = await chrome.storage.local.get([aiContextStorageKey.value]);
  if (stored[aiContextStorageKey.value]) aiContext.value = stored[aiContextStorageKey.value];

  const job = await aiJob.getPendingJob();
  if (job?.reportId) resumeAiAnalyze(job.reportId, job.progress);
});

async function saveApiKey() {
  const key = apiKeyInputValue.value.trim();
  if (!key) return;
  const {options} = await chrome.storage.local.get(['options']);
  await chrome.storage.local.set({options: {...(options ?? {}), pixelToolsApiKey: key}});
  isApiKeyModalOpened.value = false;
  await aiAnalyze();
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
    const MAX_PROMPT_LENGTH = 20000;
    let prompt = buildSystemPrompt(buildAiData(), props.dateRange, aiContext.value);
    if (prompt.length > MAX_PROMPT_LENGTH) {
      prompt = prompt.slice(0, MAX_PROMPT_LENGTH);
      toast.add({ group: 'task-analysis', severity: 'warn', summary: 'AI', detail: `Данные обрезаны — промпт превышал ${MAX_PROMPT_LENGTH} символов`, life: 5000 });
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
    // Без ключа продолжить опрос невозможно — забываем задачу, чтобы не пытаться бесконечно
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

const copied = ref(false);

async function copyToClipboard() {
  const {headers, dataRows} = buildRows();
  const text = [headers, ...dataRows].map((row) => row.join(props.copySeparator)).join('\n');
  await navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

function exportCsv() {
  const {headers, dataRows} = buildRows();
  const csv = [headers, ...dataRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(props.csvSeparator))
    .join('\n');
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'task-summary.csv';
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="flex gap-1 justify-between mb-2">
    <div class="flex gap-1">
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
          v-tooltip="'Доп. контекст для AI'"
          size="small"
          severity="secondary"
          :icon="aiContext.trim() ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
          @click="isAiContextModalOpened = true"
        />
        <Button
          v-tooltip="'Просмотр системного промпта'"
          size="small"
          severity="secondary"
          icon="pi pi-eye"
          @click="isPromptPreviewModalOpened = true"
        />
      </InputGroup>
    </div>
    <div class="flex gap-1">
      <Button
        size="small"
        severity="secondary"
        variant="text"
        icon="pi pi-copy"
        :label="copied ? 'Скопировано' : 'Копировать'"
        @click="copyToClipboard"
      />
      <Button
        size="small"
        severity="secondary"
        variant="text"
        icon="pi pi-download"
        label="CSV"
        @click="exportCsv"
      />
    </div>
  </div>
  <DataTable
    :value="rows"
    data-key="userId"
    sort-field="totalPoints"
    :sort-order="-1"
    :default-sort-order="-1"
    size="small"
  >
    <Column
      v-if="multiUser"
      field="userName"
      header="Исполнитель"
      :sortable="rows.length > 1"
    />
    <Column
      field="totalPoints"
      header="Баллов всего"
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.totalPoints }}
        <span
          v-if="data.deltaTotal !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaTotal > 0, 'text-red-400': data.deltaTotal < 0, 'text-surface-400': data.deltaTotal === 0}"
        ><template v-if="data.deltaTotal > 0">+</template>{{ data.deltaTotal }}</span>
      </template>
    </Column>
    <Column
      field="totalTasks"
      header="Задач всего"
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.totalTasks }}
        <span
          v-if="data.deltaTotalTasks !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaTotalTasks > 0, 'text-red-400': data.deltaTotalTasks < 0, 'text-surface-400': data.deltaTotalTasks === 0}"
        ><template v-if="data.deltaTotalTasks > 0">+</template>{{ data.deltaTotalTasks }}</span>
      </template>
    </Column>
    <Column
      field="totalRoots"
      header="Корневые"
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.totalRoots }}
        <span
          v-if="data.deltaTotalRoots !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaTotalRoots > 0, 'text-red-400': data.deltaTotalRoots < 0, 'text-surface-400': data.deltaTotalRoots === 0}"
        ><template v-if="data.deltaTotalRoots > 0">+</template>{{ data.deltaTotalRoots }}</span>
      </template>
    </Column>
    <Column
      field="decompRatio"
      :sortable="rows.length > 1"
    >
      <template #header>
        <b v-tooltip.top="'Отношение декомпозированных задач к корневым.\nПоказывает, сколько в среднем задач приходится на одну корневую.'">Коэф. декомп.</b>
      </template>
      <template #body="{ data }">
        {{ data.decompRatio }}
        <span
          v-if="data.deltaDecompRatio !== null"
          class="text-sm text-surface-400"
        ><template v-if="data.deltaDecompRatio > 0">+</template>{{ data.deltaDecompRatio }}</span>
      </template>
    </Column>
    <Column
      field="avgPointsPerTask"
      header="Средний балл / задачу"
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.avgPointsPerTask }}
        <span
          v-if="data.deltaAvgPointsPerTask !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaAvgPointsPerTask > 0, 'text-red-400': data.deltaAvgPointsPerTask < 0, 'text-surface-400': data.deltaAvgPointsPerTask === 0}"
        ><template v-if="data.deltaAvgPointsPerTask > 0">+</template>{{ data.deltaAvgPointsPerTask }}</span>
      </template>
    </Column>
    <Column
      field="avgPoints"
      header="Средний балл / мес."
      :sortable="rows.length > 1"
    >
      <template #body="{ data }">
        {{ data.avgPoints }}
        <span
          v-if="data.deltaAvgPoints !== null"
          class="text-sm"
          :class="{'text-green-400': data.deltaAvgPoints > 0, 'text-red-400': data.deltaAvgPoints < 0, 'text-surface-400': data.deltaAvgPoints === 0}"
        ><template v-if="data.deltaAvgPoints > 0">+</template>{{ data.deltaAvgPoints }}</span>
      </template>
    </Column>
    <Column
      field="pointDistribution"
      header="Распределение"
    >
      <template #body="{ data }">
        <div
          v-tooltip="buildDistTooltip(data.pointDistribution, data.prevPointDistribution ?? null)"
          class="flex flex-col gap-px"
        >
          <div class="flex h-4 rounded overflow-hidden min-w-25 gap-px">
            <div
              v-for="seg in data.pointDistribution"
              :key="seg.points"
              :style="{
                width: seg.pct + '%',
                minWidth: '3px',
                backgroundColor: getPointColor(seg.points),
              }"
            />
          </div>
        </div>
      </template>
    </Column>
  </DataTable>

  <div
    v-if="aiResult"
    ref="aiResultElement"
    class="mt-4 max-w-[1000px]"
  >
    <div class="flex items-center gap-1 mb-2 text-sm text-surface-400">
      <i class="pi pi-sparkles" />
      <span>Результат AI анализа</span>
    </div>
    <div
      class="pts-ai-result p-3 rounded border border-surface-200 text-sm leading-relaxed"
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
      <p class="text-xs text-surface-400 mt-1 mb-3">
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
    <p class="text-sm text-surface-500 mb-3">
      Дополнительная информация для AI: особенности команды, периода, что учесть при анализе.
    </p>
    <div class="relative">
      <Textarea
        :value="aiContext"
        :maxlength="AI_CONTEXT_MAX_LENGTH"
        rows="6"
        fluid
        placeholder="Например: Иван junior-разработчик, Мария совмещает разработку и аналитику, в марте команда онбордила двух новых сотрудников..."
        @input="onAiContextInput"
      />
      <span class="absolute bottom-2 right-2 text-xs text-surface-400 pointer-events-none">
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
    <div class="text-right text-xs text-surface-400 mt-2">
      {{ promptPreview.length }} символов
    </div>
  </Dialog>
</template>
