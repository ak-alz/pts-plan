<script setup>
import dayjs from 'dayjs';
import { forEachRight, orderBy, sum } from 'lodash-es';
import { Button, ButtonGroup, Dialog, Password, Skeleton, Textarea, ToggleButton } from 'primevue';
import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { useAiJob } from '../../../composables/useAiJob.js';
import { usePromptLibrary } from '../../../composables/usePromptLibrary.js';
import { SPRINT_SUMMARY_BB_USER_RE, SPRINT_SUMMARY_RE, SPRINT_SUMMARY_URL_USER_RE } from '../../../patterns.js';
import { PixelToolsApi } from '../../../PixelToolsApi.js';
import { renderAiMarkdown } from '../../../renderAiMarkdown.js';
import {showToast} from '../../../toastHost/showToast.js';
import DateRangePicker from '../../../ui/DateRangePicker.vue';
import PromptLibraryButton from '../../../ui/PromptLibraryButton.vue';
import {formatBytes, stringToPastelColor} from '../../../utils.js';
import {buildPeriodLabel, buildPromptPreview, buildSystemPrompt} from '../buildSystemPrompt.js';
import { buildCacheSignature, clearCache, getCacheSizeBytes, loadCache, saveCache } from '../cache.js';
import {promptSpec} from '../promptSpec.js';
import { aggregateTeamSprints, computePointsStats, computeTrend, defaultIgnorePoints, defaultMonths, normalizeSprintsToFullTeam } from '../variables.js';
import CreateTaskTemplate from './CreateTaskTemplate.vue';
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

const bitrixApi = new BitrixApi(props.sessionId);

const settings = ref({});
const settingsStorageKey = computed(() => `scrum-summary-settings-${props.groupId}`);
const isLoading = ref(false);
const cachedAt = ref(null);
const cacheSizeBytes = ref(0);
const sprintDates = ref([]);
const minSprintDate = computed(() => sprintDates.value.length ? new Date(Math.min(...sprintDates.value.map((d) => d.getTime()))) : undefined);
const maxSprintDate = computed(() => sprintDates.value.length ? new Date(Math.max(...sprintDates.value.map((d) => d.getTime()))) : undefined);
const users = ref([]);

// Пока показывать нечего — скелетоны; поверх восстановленных из кэша итогов их быть не должно
const isInitialLoading = computed(() => isLoading.value && !users.value.length);

const cacheSignature = computed(() => buildCacheSignature(settings.value));

const cacheSizeLabel = computed(() => {
  return formatBytes(cacheSizeBytes.value);
});

const cachedAtLabel = computed(() => {
  if (!cachedAt.value) return '';
  const savedAt = dayjs(cachedAt.value);
  return savedAt.isSame(dayjs(), 'day') ? savedAt.format('HH:mm') : savedAt.format('DD.MM HH:mm');
});

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

      const { avg, median } = computePointsStats(currentPeriod.map(({ y }) => y));
      const { avg: prevAvg, median: prevMedian } = computePointsStats(prevPeriod.map(({ y }) => y));

      return {
        ...user,
        visibleSprints: currentPeriod,
        prevSprints: prevPeriod,
        filteredSprintsLength: currentPeriod.length,
        avg,
        median,

        hasPrevPeriod: prevPeriod.length > 0,
        deltaAvg: prevPeriod.length ? avg - prevAvg : 0,
        deltaMedian: prevPeriod.length ? median - prevMedian : 0,

        ...computeTrend(currentPeriod),
      };
    });
});
const dateUpdated = ref(null);
const trendMode = ref(false);

function withUserId(sprints, userId) {
  return sprints.map((sprint) => ({ ...sprint, userId }));
}

// Показатели команды считаются по суммарным баллам за каждый спринт, а не усреднением личных
// средних: состав исполнителей от спринта к спринту меняется, и среднее из средних это скрывает
const teamSummary = computed(() => {
  if (computedUsers.value.length < 2) return null;

  const currentSprints = aggregateTeamSprints(computedUsers.value.flatMap((user) => withUserId(user.visibleSprints, user.id)));
  if (!currentSprints.length) return null;

  const previousSprints = aggregateTeamSprints(computedUsers.value.flatMap((user) => withUserId(user.prevSprints, user.id)));

  // Ожидаемый вклад считаем по обоим периодам сразу: веса не должны меняться между периодами,
  // иначе сравнение «текущий против предыдущего» поедет само по себе
  const expectedPointsByUser = Object.fromEntries(computedUsers.value.map((user) => {
    const points = [...user.visibleSprints, ...user.prevSprints].map(({ y }) => y);
    return [user.id, points.length ? sum(points) / points.length : 0];
  }));

  const normalizedCurrent = normalizeSprintsToFullTeam(currentSprints, expectedPointsByUser);
  const normalizedPrevious = normalizeSprintsToFullTeam(previousSprints, expectedPointsByUser);

  const { avg, median } = computePointsStats(currentSprints.map(({ y }) => y));
  const normalized = computePointsStats(normalizedCurrent.map(({ y }) => y));
  const normalizedPrev = computePointsStats(normalizedPrevious.map(({ y }) => y));

  const totalPoints = sum(currentSprints.map(({ y }) => y));
  const totalParticipations = sum(currentSprints.map((sprint) => sprint.participantIds.length));

  return {
    sprintsCount: currentSprints.length,
    totalPoints,
    avgParticipants: Math.round((totalParticipations / currentSprints.length) * 10) / 10,
    avgPerParticipant: Math.round(totalPoints / totalParticipations),
    avg,
    median,
    normalizedAvg: normalized.avg,

    hasPrevPeriod: previousSprints.length > 0,
    deltaAvg: previousSprints.length ? normalized.avg - normalizedPrev.avg : 0,
    deltaMedian: previousSprints.length ? normalized.median - normalizedPrev.median : 0,

    ...computeTrend(normalizedCurrent),
  };
});


async function loadSettings() {
  const res = await chrome.storage.local.get([settingsStorageKey.value]);
  if (res[settingsStorageKey.value]) {
    settings.value = res[settingsStorageKey.value];
  }
}

// Даты спринтов выводятся из самих итогов, поэтому в кэше их держать незачем
function collectSprintDates(loadedUsers) {
  const dateSet = new Set();
  loadedUsers.forEach((user) => {
    user.sprints.forEach((sprint) => {
      dateSet.add(dayjs(sprint.x).startOf('day').valueOf());
    });
  });
  return Array.from(dateSet).map((timestamp) => new Date(timestamp));
}

async function refreshCacheSize() {
  cacheSizeBytes.value = await getCacheSizeBytes(props.groupId);
}

async function resetCache() {
  await clearCache(props.groupId);
  await refreshCacheSize();
  showToast({
    severity: 'success',
    summary: 'Кэш очищен',
    detail: 'Сохранённые итоги спринтов удалены. При следующем открытии виджет дождётся загрузки.',
    life: 5000,
  });
}

async function restoreFromCache() {
  const cache = await loadCache(props.groupId, cacheSignature.value);
  if (!cache?.users?.length) return;

  users.value = cache.users;
  sprintDates.value = collectSprintDates(cache.users);
  cachedAt.value = cache.savedAt;
}

async function persistCache() {
  if (!settings.value.taskId || !users.value.length) return;

  await saveCache(props.groupId, cacheSignature.value, {users: users.value});
  await refreshCacheSize();
}

async function fetchData() {
  if (!settings.value.taskId) {
    return;
  }

  isLoading.value = true;

  try {
    const comments = await bitrixApi.getComments(settings.value.taskId);

    if (!comments.length) {
      throw new Error(`Не удалось найти комментарии для задачи ${settings.value.taskId}`);
    }

    // Регулярки живут в patterns.js — там же, где и остальная бизнес-логика поиска по тексту
    const sprintPattern = SPRINT_SUMMARY_RE;
    const urlUserPattern = SPRINT_SUMMARY_URL_USER_RE;
    const bbUserPattern = SPRINT_SUMMARY_BB_USER_RE;

    const usersMap = {};

    forEachRight(comments, (comment) => {
      sprintPattern.lastIndex = 0;

      const match = sprintPattern.exec(comment.POST_MESSAGE);
      if (!match) return;

      const sprintNumber = match[1] !== undefined ? Number(match[1]) : null;
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

    users.value = orderBy(Object.values(usersMap), [(user) => user.sprints.length], 'desc');
    sprintDates.value = collectSprintDates(users.value);

    dateUpdated.value = `Последнее обновление: ${dayjs().format('HH:mm:ss')}`;
    cachedAt.value = null;
    await persistCache();
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

const AI_CONTEXT_MAX_LENGTH = 1000;

const aiContextStorageKey = computed(() => `scrum-summary-ai-context-${props.groupId}`);
const aiContext = ref('');
const isAiContextModalOpened = ref(false);
const isPromptPreviewModalOpened = ref(false);

function buildAiData() {
  const ignorePoints = typeof settings.value.ignorePoints === 'number' ? settings.value.ignorePoints : defaultIgnorePoints;
  const aiData = computedUsers.value.map((user) => {
    const entry = {
      исполнитель: user.name,
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
    if (user.hasPrevPeriod) {
      entry.дельта_среднего = user.deltaAvg;
      entry.дельта_медианы = user.deltaMedian;
    }
    return entry;
  });

  const team = teamSummary.value;
  if (team) {
    aiData.push({
      исполнитель: 'ВСЯ КОМАНДА (суммарно за спринт)',
      спринтов_в_периоде: team.sprintsCount,
      исполнителей_в_спринте: team.avgParticipants,
      средний_балл: team.avg,
      медианный_балл: team.median,
      средний_балл_на_исполнителя: team.avgPerParticipant,
      средний_балл_при_полном_составе: team.normalizedAvg,
      всего_баллов_за_период: team.totalPoints,
      ...(team.trendDelta !== null ? {
        тренд_начало: team.trendStart,
        тренд_конец: team.trendEnd,
        тренд_дельта: team.trendDelta,
        ...(team.trendPct !== null ? {тренд_процент: `${team.trendPct > 0 ? '+' : ''}${team.trendPct}%`} : {}),
      } : {}),
      ...(team.hasPrevPeriod ? {
        дельта_среднего: team.deltaAvg,
        дельта_медианы: team.deltaMedian,
      } : {}),
    });
  }

  return {aiData, ignorePoints};
}

const promptLibrary = usePromptLibrary(promptSpec);

const promptPreview = computed(() => {
  const customPreview = promptLibrary.previewActivePrompt();
  if (customPreview) return customPreview;
  const ignorePoints = typeof settings.value.ignorePoints === 'number' ? settings.value.ignorePoints : defaultIgnorePoints;
  return buildPromptPreview(ignorePoints, form.dateRange, aiContext.value.trim() || null);
});

async function onAiContextInput(e) {
  aiContext.value = e.target.value.slice(0, AI_CONTEXT_MAX_LENGTH);
  await chrome.storage.local.set({[aiContextStorageKey.value]: aiContext.value});
}

const aiResult = ref('');
const aiResultHtml = computed(() => renderAiMarkdown(aiResult.value));
const aiResultElement = ref(null);

const isApiKeyModalOpened = ref(false);
const apiKeyInputValue = ref('');

const aiJob = useAiJob(() => `scrum-summary-ai-job-${props.groupId}`, {
  onAuthError: () => { isApiKeyModalOpened.value = true; },
});
const aiLoading = aiJob.loading;
const aiProgress = aiJob.progress;
const aiButtonLabel = computed(() => aiLoading.value && aiProgress.value !== null ? `AI анализ (${aiProgress.value}%)` : 'AI анализ');

async function scrollToAiResult() {
  await nextTick();
  aiResultElement.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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
  await aiJob.runJob(async () => {
    const {aiData, ignorePoints} = buildAiData();

    await promptLibrary.ready;
    const MAX_PROMPT_LENGTH = 20000;
    let prompt = promptLibrary.buildActivePrompt({
      data: JSON.stringify(aiData),
      period: buildPeriodLabel(form.dateRange) ?? '',
      ignorePoints: String(ignorePoints),
      extraContext: aiContext.value,
    }) ?? buildSystemPrompt(aiData, ignorePoints, form.dateRange, aiContext.value);
    if (prompt.length > MAX_PROMPT_LENGTH) {
      prompt = prompt.slice(0, MAX_PROMPT_LENGTH);
      showToast({ severity: 'warn', summary: 'AI', detail: `Данные обрезаны — промпт превышал ${MAX_PROMPT_LENGTH} символов`, life: 5000 });
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

/* Настройки */
const isSettingsModalOpened = ref(false);
const isCreateTaskModalOpened = ref(false);

async function onTaskTemplateCreated() {
  isCreateTaskModalOpened.value = false;
  await loadSettings();
  Object.assign(form, getDefaults());
  fetchData();
}

async function onSaveSettings() {
  isSettingsModalOpened.value = false;

  const oldTaskId = settings.value.taskId;

  await loadSettings();

  Object.assign(form, getDefaults());

  if (settings.value.taskId !== oldTaskId) {
    await fetchData();
  }
}

onMounted(async () => {
  await loadSettings();
  Object.assign(form, getDefaults());
  const stored = await chrome.storage.local.get([aiContextStorageKey.value]);
  if (stored[aiContextStorageKey.value]) aiContext.value = stored[aiContextStorageKey.value];
  // Прошлые итоги рисуем сразу, свежие догружаются следом и заменяют их
  await Promise.all([restoreFromCache(), refreshCacheSize()]);
  fetchData();

  const job = await aiJob.getPendingJob();
  if (job?.reportId) resumeAiAnalyze(job.reportId, job.progress);
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
      <Button
        v-if="cacheSizeBytes > 0"
        v-tooltip="'Виджет запоминает разобранные итоги спринтов, чтобы при открытии не ждать загрузки комментариев задачи. Кнопка удаляет их для этой группы — на экране всё останется, но следующее открытие снова будет ждать загрузки.'"
        :label="`Сбросить кэш (${cacheSizeLabel})`"
        size="small"
        severity="secondary"
        icon="pi pi-trash"
        variant="text"
        @click="resetCache"
      />
      <ToggleButton
        v-if="!isInitialLoading"
        v-model="trendMode"
        on-label="Тренды"
        off-label="Тренды"
        on-icon="pi pi-chart-line"
        off-icon="pi pi-chart-line"
        size="small"
      />
      <div
        v-if="!isInitialLoading"
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
        v-if="!isInitialLoading && computedUsers.length"
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
        <PromptLibraryButton :library="promptLibrary" />
        <Button
          v-tooltip="'Просмотр системного промпта'"
          size="small"
          severity="secondary"
          icon="pi pi-eye"
          @click="isPromptPreviewModalOpened = true"
        />
      </ButtonGroup>
      <span
        v-if="cachedAt"
        class="text-xs text-surface-500 dark:text-surface-400"
      >
        Сохранённые данные от {{ cachedAtLabel }}{{ isLoading ? ' — обновляем…' : '' }}
      </span>
    </div>

    <Skeleton
      v-if="isInitialLoading"
      style="height: 100px; width: 1000px;"
      class="mb-3"
    />

    <SummaryTable
      v-else
      :users="computedUsers"
      :team="teamSummary"
      :trend-mode="trendMode"
      class="mb-3"
    />

    <Skeleton
      v-if="isInitialLoading"
      style="height: 300px; width: 1000px;"
    />

    <SummaryChart
      v-show="!isInitialLoading"
      :users="computedUsers"
      :trend-mode="trendMode"
    />

    <div
      v-if="aiResult"
      ref="aiResultElement"
      class="mt-4 max-w-[800px]"
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
  </div>

  <template v-else>
    <SettingsForm
      :users

      :initial="settings"
      :settings-storage-key
      simple
      @success="onSaveSettings"
    />
    <Button
      class="mt-3"
      fluid
      label="Создать шаблон задачи"
      size="small"
      severity="secondary"
      icon="pi pi-plus"
      @click="isCreateTaskModalOpened = true"
    />
  </template>

  <Dialog
    v-model:visible="isCreateTaskModalOpened"
    header="Создать шаблон задачи"
    dismissable-mask
    modal
  >
    <CreateTaskTemplate
      :session-id
      :group-id
      :settings-storage-key
      @success="onTaskTemplateCreated"
    />
  </Dialog>

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
      <span class="absolute bottom-2 right-2 text-xs text-surface-400 dark:text-surface-500 pointer-events-none">
        {{ aiContext.length }} / {{ AI_CONTEXT_MAX_LENGTH }}
      </span>
    </div>
  </Dialog>

  <Dialog
    v-model:visible="isPromptPreviewModalOpened"
    :header="promptLibrary.activePrompt.value ? `Промпт: ${promptLibrary.activePrompt.value.name}` : 'Системный промпт'"
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
