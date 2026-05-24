<script setup>
import dayjs from 'dayjs';
import { forEachRight, orderBy, sum } from 'lodash-es';
import { marked } from 'marked';
import { Button, ButtonGroup, Dialog, Password, Skeleton, Textarea, ToggleButton } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { PixelToolsApi } from '../../../PixelToolsApi.js';
import DateRangePicker from '../../../ui/DateRangePicker.vue';
import {stringToPastelColor} from '../../../utils.js';
import {buildPromptPreview, buildSystemPrompt} from '../buildSystemPrompt.js';
import { computeTrendLine, defaultIgnorePoints, defaultMonths } from '../variables.js';
import SettingsForm from './SettingsForm.vue';
import SummaryChart from './SummaryChart.vue';
import SummaryTable from './SummaryTable.vue';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
});

const toast = useToast();

const bitrixApi = new BitrixApi(props.sessionId);

const settings = ref({});
const settingsStorageKey = computed(() => `scrum-summary-settings-${props.groupId}`);
const isLoading = ref(false);
const sprintDates = ref([]);
const minSprintDate = computed(() => sprintDates.value.length ? new Date(Math.min(...sprintDates.value.map((d) => d.getTime()))) : undefined);
const maxSprintDate = computed(() => sprintDates.value.length ? new Date(Math.max(...sprintDates.value.map((d) => d.getTime()))) : undefined);
const users = ref([]);

function getDefaults() {
  const months = settings.value.defaultMonths ?? defaultMonths;
  return {
    dateRange: [dayjs().subtract(months, 'month').toDate(), dayjs().toDate()],
  };
}

const form = reactive({ ...getDefaults() });

const computedUsers = computed(() => {
  const ignorePoints = typeof settings.value.ignorePoints === 'number' ? settings.value.ignorePoints : defaultIgnorePoints;
  const rangeStart = form.dateRange?.[0] ? dayjs(form.dateRange[0]).startOf('day') : null;
  const rangeEnd = form.dateRange?.[1] ? dayjs(form.dateRange[1]).endOf('day') : null;

  const prevRangeEnd = rangeStart ? rangeStart.subtract(1, 'day').endOf('day') : null;
  const prevRangeStart = (rangeStart && rangeEnd)
    ? rangeStart.subtract(rangeEnd.diff(rangeStart, 'day') + 1, 'day').startOf('day')
    : null;

  return users.value
    .filter(({ id }) => settings.value.users?.length && settings.value.users?.includes(id))
    .map((user) => {
      const allFiltered = user.sprints.filter(({y}) => y >= ignorePoints);

      const currentPeriod = allFiltered.filter(({x}) => {
        if (!rangeStart && !rangeEnd) return true;
        const d = dayjs(x);
        if (rangeStart && d.isBefore(rangeStart)) return false;
        if (rangeEnd && d.isAfter(rangeEnd)) return false;
        return true;
      });

      const prevPeriod = allFiltered.filter(({x}) => {
        if (!prevRangeStart || !prevRangeEnd) return false;
        const d = dayjs(x);
        return !d.isBefore(prevRangeStart) && !d.isAfter(prevRangeEnd);
      });

      const points = currentPeriod.map(({ y }) => y).sort((a, b) => a - b);
      const avg = points.length ? Math.round(sum(points) / points.length) : 0;
      const median = points.length ? Math.round(getMedian(points)) : 0;

      const prevPoints = prevPeriod.map(({ y }) => y).sort((a, b) => a - b);
      const prevAvg = prevPoints.length ? Math.round(sum(prevPoints) / prevPoints.length) : 0;
      const prevMedian = prevPoints.length ? Math.round(getMedian(prevPoints)) : 0;

      const trendLine = currentPeriod.length >= 2 ? computeTrendLine(currentPeriod) : null;
      const trendStart = trendLine?.[0].y ?? null;
      const trendEnd = trendLine?.[trendLine.length - 1].y ?? null;
      const trendDelta = trendStart !== null && trendEnd !== null ? trendEnd - trendStart : null;
      const trendPct = trendDelta !== null && trendStart !== 0
        ? Math.round((trendDelta / trendStart) * 100)
        : null;

      return {
        ...user,
        visibleSprints: currentPeriod,
        filteredSprintsLength: currentPeriod.length,
        avg,
        median,

        deltaAvg: prevPoints.length ? avg - prevAvg : 0,
        deltaMedian: prevPoints.length ? median - prevMedian : 0,

        trendLine,
        trendStart,
        trendEnd,
        trendDelta,
        trendPct,
      };
    });
});
const dateUpdated = ref(null);
const trendMode = ref(false);

function getMedian(values) {
  const mid = Math.floor(values.length / 2);

  return (values.length % 2
      ? values[mid]
      : (values[mid - 1] + values[mid]) / 2
  );
}

async function loadSettings() {
  const res = await chrome.storage.local.get([settingsStorageKey.value]);
  if (res[settingsStorageKey.value]) {
    settings.value = res[settingsStorageKey.value];
  }
}

async function fetchData() {
  if (!settings.value.taskId) {
    return;
  }

  isLoading.value = true;

  try {
    const { data } = await bitrixApi.getComments(settings.value.taskId);
    const comments = data.result;

    if (!comments.length) {
      throw new Error(`Не удалось найти комментарии для задачи ${settings.value.taskId}`);
    }

    // Паттерн отбирает из всех комментариев задачи только комментарии с итогами спринта
    const sprintPattern = /итоги?[^]*?(\d+)[^]*?спринт/gi;
    // Новый формат: [URL=.../user/ID/]Имя[/URL] — N балл
    const urlUserPattern = /\[URL=([^\]]*\/company\/personal\/user\/(\d+)\/)]([^[\n]+)\[\/URL][^\d\n]*(\d+)\s+балл/g;
    // Старый формат: [USER=ID]Имя[/USER] — N балл
    const bbUserPattern = /\[USER=(\d+)]([^[\n]+)\[\/USER][^\d\n]*(\d+)\s+балл/g;

    const usersMap = {};

    forEachRight(comments, (comment) => {
      sprintPattern.lastIndex = 0;

      const match = sprintPattern.exec(comment.POST_MESSAGE);
      if (!match) return;

      const sprintNumber = Number(match[1]);
      const dateTs = dayjs(comment.POST_DATE).valueOf();

      urlUserPattern.lastIndex = 0;
      bbUserPattern.lastIndex = 0;
      const hasUsers = urlUserPattern.test(comment.POST_MESSAGE) || bbUserPattern.test(comment.POST_MESSAGE);
      if (!hasUsers) return;

      const addUser = (id, name, url, points) => {
        if (!usersMap[id]) {
          usersMap[id] = { id, name, url, sprints: [], color: stringToPastelColor(name) };
        }
        usersMap[id].sprints.push({ x: dateTs, y: points, sprint: sprintNumber });
      };

      let userMatch;
      urlUserPattern.lastIndex = 0;
      while ((userMatch = urlUserPattern.exec(comment.POST_MESSAGE)) !== null) {
        const [, url, id, name, pointsStr] = userMatch;
        addUser(id, name, url, Number(pointsStr));
      }

      bbUserPattern.lastIndex = 0;
      while ((userMatch = bbUserPattern.exec(comment.POST_MESSAGE)) !== null) {
        const [, id, name, pointsStr] = userMatch;
        addUser(id, name, `/company/personal/user/${id}/`, Number(pointsStr));
      }
    });

    const dateSet = new Set();
    Object.values(usersMap).forEach((user) => {
      user.sprints.forEach((sprint) => {
        dateSet.add(dayjs(sprint.x).startOf('day').valueOf());
      });
    });
    sprintDates.value = Array.from(dateSet).map((ts) => new Date(ts));

    users.value = orderBy(Object.values(usersMap), [(user) => user.sprints.length], 'desc');

    dateUpdated.value = `Последнее обновление: ${dayjs().format('HH:mm:ss')}`;
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

const AI_CONTEXT_MAX_LENGTH = 1000;

const aiContextStorageKey = computed(() => `scrum-summary-ai-context-${props.groupId}`);
const aiContext = ref('');
const isAiContextModalOpened = ref(false);
const isPromptPreviewModalOpened = ref(false);

function buildAiData() {
  const ignorePoints = typeof settings.value.ignorePoints === 'number' ? settings.value.ignorePoints : defaultIgnorePoints;
  const aiData = computedUsers.value.map((user) => {
    const entry = {
      участник: user.name,
      спринтов_в_периоде: user.visibleSprints.length,
      средний_балл: user.avg,
      медианный_балл: user.median,
    };
    if (user.trendDelta !== null) {
      entry.тренд_начало = user.trendStart;
      entry.тренд_конец = user.trendEnd;
      entry.тренд_дельта = user.trendDelta;
      if (user.trendPct !== null) entry.тренд_процент = `${user.trendPct > 0 ? '+' : ''}${user.trendPct}%`;
    }
    if (user.deltaAvg) {
      entry.дельта_среднего = user.deltaAvg;
      entry.дельта_медианы = user.deltaMedian;
    }
    return entry;
  });
  return {aiData, ignorePoints};
}

const promptPreview = computed(() => {
  const ignorePoints = typeof settings.value.ignorePoints === 'number' ? settings.value.ignorePoints : defaultIgnorePoints;
  return buildPromptPreview(ignorePoints, form.dateRange, aiContext.value.trim() || null);
});

async function onAiContextInput(e) {
  aiContext.value = e.target.value.slice(0, AI_CONTEXT_MAX_LENGTH);
  await chrome.storage.local.set({[aiContextStorageKey.value]: aiContext.value});
}

const aiLoading = ref(false);
const aiProgress = ref(null);
const aiResult = ref('');
const aiButtonLabel = computed(() => aiLoading.value && aiProgress.value !== null ? `AI анализ (${aiProgress.value}%)` : 'AI анализ');
const aiResultHtml = computed(() => aiResult.value ? marked(aiResult.value) : '');

const isApiKeyModalOpened = ref(false);
const apiKeyInputValue = ref('');

async function saveApiKey() {
  const key = apiKeyInputValue.value.trim();
  if (!key) return;
  const {options} = await chrome.storage.local.get(['options']);
  await chrome.storage.local.set({options: {...(options ?? {}), pixelToolsApiKey: key}});
  isApiKeyModalOpened.value = false;
  await aiAnalyze();
}

async function aiAnalyze() {
  const {options} = await chrome.storage.local.get(['options']);
  const apiKey = options?.pixelToolsApiKey;
  if (!apiKey) {
    isApiKeyModalOpened.value = true;
    return;
  }

  aiLoading.value = true;
  aiProgress.value = null;
  aiResult.value = '';

  try {
    const {aiData, ignorePoints} = buildAiData();

    const MAX_PROMPT_LENGTH = 20000;
    let prompt = buildSystemPrompt(aiData, ignorePoints, form.dateRange, aiContext.value);
    if (prompt.length > MAX_PROMPT_LENGTH) {
      prompt = prompt.slice(0, MAX_PROMPT_LENGTH);
      toast.add({ severity: 'warn', summary: 'AI', detail: `Данные обрезаны — промпт превышал ${MAX_PROMPT_LENGTH} символов`, life: 5000 });
    }

    aiResult.value = await new PixelToolsApi(apiKey).chat(prompt, '', (p) => {
      aiProgress.value = p;
    });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'AI', detail: e.message, life: 5000 });
    isApiKeyModalOpened.value = true;
  } finally {
    aiLoading.value = false;
    aiProgress.value = null;
  }
}

/* Настройки */
const isSettingsModalOpened = ref(false);

async function onSaveSettings() {
  isSettingsModalOpened.value = false;

  const oldTaskId = settings.value.taskId;

  await loadSettings();

  Object.assign(form, getDefaults());

  if (settings.value.taskId !== oldTaskId) {
    fetchData();
  }
}

onMounted(async () => {
  await loadSettings();
  Object.assign(form, getDefaults());
  const stored = await chrome.storage.local.get([aiContextStorageKey.value]);
  if (stored[aiContextStorageKey.value]) aiContext.value = stored[aiContextStorageKey.value];
  fetchData();
});
</script>

<template>
  <div v-if="settings.taskId">
    <div class="flex gap-2 mb-3 items-center flex-wrap">
      <Button
        label="Настройки"
        :loading="isLoading"
        size="small"
        severity="secondary"
        icon="pi pi-cog"
        variant="text"
        @click="isSettingsModalOpened = true"
      />
      <Button
        v-tooltip="dateUpdated"
        label="Обновить"
        :loading="isLoading"
        size="small"
        severity="secondary"
        icon="pi pi-refresh"
        variant="text"
        @click="fetchData"
      />
      <ToggleButton
        v-if="!isLoading"
        v-model="trendMode"
        on-label="Тренды"
        off-label="Тренды"
        on-icon="pi pi-chart-line"
        off-icon="pi pi-chart-line"
        size="small"
      />
      <div
        v-if="!isLoading"
        class="w-52"
      >
        <DateRangePicker
          v-model="form.dateRange"
          :min-date="minSprintDate"
          :max-date="maxSprintDate"
          :event-dates="sprintDates"
        />
      </div>
      <ButtonGroup
        v-if="!isLoading && computedUsers.length"
        :pt="{root: {style: {width: 'auto'}}}"
      >
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
      </ButtonGroup>
    </div>

    <Skeleton
      v-if="isLoading"
      style="height: 100px; width: 1000px;"
      class="mb-3"
    />

    <SummaryTable
      v-else
      :users="computedUsers"
      :trend-mode="trendMode"
      class="mb-3"
    />

    <Skeleton
      v-if="isLoading"
      style="height: 300px; width: 1000px;"
    />

    <SummaryChart
      v-show="!isLoading"
      :users="computedUsers"
      :trend-mode="trendMode"
    />

    <div
      v-if="aiResult"
      class="mt-4 max-w-[800px]"
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
  </div>

  <SettingsForm
    v-else
    :users

    :initial="settings"
    :settings-storage-key
    simple
    @success="onSaveSettings"
  />

  <Dialog
    v-model:visible="isSettingsModalOpened"
    header="Настройки"
    dismissable-mask
    modal
  >
    <SettingsForm
      :users

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
      Дополнительная информация для AI: особенности команды, спринта, что учесть при анализе.
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
