<script setup>
import dayjs from 'dayjs';
import {
  Button,
  Checkbox,
  Dialog,
  InputGroup,
  InputGroupAddon,
  Message,
  ProgressBar,
  Select,
  SelectButton,
  Skeleton,
} from 'primevue';
import {computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch} from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import {showToast} from '../../../toastHost/showToast.js';
import DateRangePicker from '../../../ui/DateRangePicker.vue';
import FormField from '../../../ui/FormField.vue';
import {computeDefaultCompareRange, getCompareRequestRange, pluralize} from '../../../utils.js';
import {
  clearCache,
  getCacheSizeBytes,
  getMissingDayKeys,
  isSnapshotFresh,
  loadCache,
  markDaysCovered,
  omitDays,
  saveCache,
} from '../cache.js';
import {
  buildBuckets,
  buildDayAggregates,
  buildStageSnapshots,
  computeBacklogSnapshot,
  computeBucketRows,
  computeMetrics,
  getDayKeys,
  groupDaysIntoRanges,
  mapMilestonesToBuckets,
  normalizeTask,
} from '../metrics.js';
import {
  CONFIRM_TASK_COUNT_THRESHOLD,
  CUT_OPTIONS,
  DEFAULT_SETTINGS,
  VALUE_MODE_OPTIONS,
} from '../variables.js';
import DynamicsTabs from './DynamicsTabs.vue';
import SettingsForm from './SettingsForm.vue';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  groupId: {
    type: String,
    required: true,
  },
  options: {
    type: Object,
    default: () => ({}),
  },
});

const bitrixApi = new BitrixApi(props.sessionId);

// Историческим выборкам нужны свои поля: без STATUS не отфильтровать отклонённые, без COMMENTS_COUNT
// не посчитать уточнения. Базовые FAVORITE/CHANGED_DATE/GROUP_ID на тысячах задач только весят.
const HISTORY_SELECT_FIELDS = ['ID', 'TITLE', 'RESPONSIBLE_ID', 'CREATED_DATE', 'CLOSED_DATE', 'PARENT_ID', 'STATUS', 'COMMENTS_COUNT'];
// Живому бэклогу не нужны ни название, ни исполнитель — только возраст, давность активности и колонка
const ACTIVE_SELECT_FIELDS = ['ID', 'CREATED_DATE', 'ACTIVITY_DATE', 'STAGE_ID', 'STATUS'];

const settingsStorageKey = `task-dynamics-settings-${props.groupId}`;
const settings = ref({...DEFAULT_SETTINGS});
const isSettingsOpened = ref(false);

const stages = ref([]);
const groupUsers = ref([]);

// shallowRef, а не ref: за три года это больше тысячи дней с массивами времён внутри, и глубокое
// проксирование такого объекта заметно тормозит пересчёт метрик. Значение всегда заменяется целиком.
const dayAggregates = shallowRef({});
const snapshot = shallowRef(null);
const taskUserNames = ref({});
const fetchedDateRange = ref(null);
const fetchedCompareRange = ref(null);

const isInitialLoading = ref(true);
const isLoading = ref(false);
const isSnapshotLoading = ref(false);
const loadedRecordsByRequest = new Map();
const loadedRecords = ref(0);
const expectedRecords = ref(0);
const pendingConfirmation = ref(null);
const cacheSizeBytes = ref(0);

const cacheSizeLabel = computed(() => {
  const kilobytes = cacheSizeBytes.value / 1024;
  return kilobytes >= 1024 ? `${(kilobytes / 1024).toFixed(1)} МБ` : `${Math.round(kilobytes)} КБ`;
});

async function refreshCacheSize() {
  cacheSizeBytes.value = await getCacheSizeBytes(props.groupId);
}

async function resetCache() {
  await clearCache(props.groupId);
  await refreshCacheSize();
  showToast({
    severity: 'success',
    summary: 'Кэш очищен',
    detail: 'Сохранённые итоги по дням удалены. Следующая загрузка выкачает историю заново.',
    life: 5000,
  });
}

const progressPercent = computed(() => {
  if (!expectedRecords.value) return null;
  return Math.min(100, Math.round((loadedRecords.value / expectedRecords.value) * 100));
});

const loadButtonLabel = computed(() => {
  if (!isLoading.value || progressPercent.value === null) return 'Обновить';
  return `Загрузка (${progressPercent.value}%)`;
});

function getDefaults() {
  const months = settings.value.defaultMonths ?? DEFAULT_SETTINGS.defaultMonths;
  const dateRange = [dayjs().subtract(months, 'month').toDate(), dayjs().toDate()];
  return {
    dateRange,
    compareDateRange: computeDefaultCompareRange(dateRange),
    compareEnabled: settings.value.defaultCompareEnabled ?? DEFAULT_SETTINGS.defaultCompareEnabled,
    cut: settings.value.defaultCut ?? DEFAULT_SETTINGS.defaultCut,
    valueMode: 'absolute',
    milestoneDate: null,
  };
}

const form = reactive(getDefaults());

const compareRangeTouched = ref(false);

watch(() => form.dateRange, (newRange) => {
  if (compareRangeTouched.value) return;
  form.compareDateRange = computeDefaultCompareRange(newRange);
});

function onCompareDateRangeUpdate(value) {
  form.compareDateRange = value;
  compareRangeTouched.value = true;
}

/** Диапазон сравнения для запроса, либо `null`, когда сравнение выключено галкой. */
function getActiveCompareRange() {
  if (!form.compareEnabled) return null;
  return getCompareRequestRange(form.compareDateRange, form.dateRange);
}

function applyDefaults() {
  Object.assign(form, getDefaults());
  compareRangeTouched.value = false;
}

const milestones = computed(() => settings.value.milestones ?? []);

const milestoneOptions = computed(() => [
  {label: 'Не сравнивать', value: null},
  ...milestones.value.map((milestone) => ({
    label: `${dayjs(milestone.date).format('DD.MM.YYYY')} — ${milestone.label || 'событие'}`,
    value: milestone.date,
  })),
]);

function formatDayStart(date) {
  return dayjs(date).format('YYYY-MM-DD 00:00:00');
}

function formatDayEnd(date) {
  return dayjs(date).format('YYYY-MM-DD 23:59:59');
}

function trackProgress(requestKey) {
  return ({loaded}) => {
    loadedRecordsByRequest.set(requestKey, loaded);
    loadedRecords.value = [...loadedRecordsByRequest.values()].reduce((sum, count) => sum + count, 0);
  };
}

function requestConfirmation(taskCount) {
  return new Promise((resolve) => {
    pendingConfirmation.value = {taskCount, resolve};
  });
}

function resolveConfirmation(isConfirmed) {
  pendingConfirmation.value?.resolve(isConfirmed);
  pendingConfirmation.value = null;
}

// Окно виджета закрыли, не ответив на вопрос про объём: без этого fetchData остался бы висеть
// в await навсегда, держа isLoading и уже сделанные выборки
onUnmounted(() => resolveConfirmation(false));

function collectUserNames(tasks, userNames) {
  tasks.forEach((task) => {
    if (task.responsibleName && !userNames[task.responsibleId]) {
      userNames[task.responsibleId] = task.responsibleName;
    }
  });
}

async function fetchData({force = false} = {}) {
  if (!form.dateRange?.[0] || isLoading.value) return;

  isLoading.value = true;
  loadedRecordsByRequest.clear();
  loadedRecords.value = 0;
  expectedRecords.value = 0;

  try {
    const periodDayKeys = getDayKeys(form.dateRange);
    const compareRequestRange = getActiveCompareRange();
    const compareDayKeys = compareRequestRange ? getDayKeys(compareRequestRange) : [];
    const requiredDayKeys = [...new Set([...periodDayKeys, ...compareDayKeys])];

    const storedCache = await loadCache(props.groupId);
    // «Обновить» сбрасывает срез и агрегаты — но только тех дней, которые сейчас будут выгружены
    // заново: дни вне периода трогать нельзя, иначе обновление за месяц выкидывало бы годы истории.
    // Имена исполнителей остаются всегда: они не устаревают, а без них после загрузки из кэша
    // в таблицах были бы одни ID
    const cache = force
      ? {...storedCache, days: omitDays(storedCache.days, requiredDayKeys), snapshot: null}
      : storedCache;

    // Выгружаем только незакэшированные дни; подряд идущие склеиваются в один запрос, поэтому
    // стыкующиеся период и диапазон сравнения — это одна выборка, а не две
    const ranges = groupDaysIntoRanges(getMissingDayKeys(cache.days, requiredDayKeys));
    const needSnapshot = force || !isSnapshotFresh(cache.snapshot);

    // Предварительная оценка объёма: точные total, без выкачивания самих задач — иначе на большом
    // периоде канбан молча висел бы минуту. Все прикидки (создано и закрыто по каждому диапазону плюс
    // живой бэклог) идут одним батчем: до этого запроса виджет ещё ничего не показывает
    const countRequests = ranges.flatMap((range) => [
      {
        groupId: props.groupId,
        createdDateFrom: formatDayStart(range.from),
        createdDateTo: formatDayEnd(range.to),
      },
      {
        groupId: props.groupId,
        status: 'closed',
        closedDateFrom: formatDayStart(range.from),
        closedDateTo: formatDayEnd(range.to),
      },
    ]);
    if (needSnapshot) countRequests.push({groupId: props.groupId, status: 'active'});

    const counts = await bitrixApi.countTasksBatch(countRequests);
    const estimates = ranges.map((range, index) => ({
      range,
      createdCount: counts[index * 2] ?? 0,
      closedCount: counts[index * 2 + 1] ?? 0,
    }));
    const activeCount = needSnapshot ? (counts[ranges.length * 2] ?? 0) : 0;

    expectedRecords.value = estimates.reduce((sum, item) => sum + item.createdCount + item.closedCount, 0) + activeCount;

    if (expectedRecords.value > CONFIRM_TASK_COUNT_THRESHOLD) {
      const isConfirmed = await requestConfirmation(expectedRecords.value);
      if (!isConfirmed) return;
    }

    // Срез «сейчас» не зависит от истории, поэтому грузится параллельно с ней: это ~20 вызовов метода,
    // и ждать их, когда вся история уже в кэше, значит ждать открытия виджета впустую
    let snapshotRequest = Promise.resolve(cache.snapshot);
    if (needSnapshot) {
      isSnapshotLoading.value = true;
      snapshotRequest = bitrixApi.searchTasks({
        groupId: props.groupId,
        status: 'active',
        selectFields: ACTIVE_SELECT_FIELDS,
        onProgress: trackProgress('active'),
      })
        .then((activeTasks) => ({
          at: dayjs().toISOString(),
          stages: buildStageSnapshots(activeTasks.map(normalizeTask)),
        }))
        .finally(() => { isSnapshotLoading.value = false; });
    }

    const days = {...cache.days};
    const userNames = {...cache.users};

    for (const [index, {range, createdCount, closedCount}] of estimates.entries()) {
      const createdTasks = createdCount
        ? await bitrixApi.searchTasks({
          groupId: props.groupId,
          createdDateFrom: formatDayStart(range.from),
          createdDateTo: formatDayEnd(range.to),
          selectFields: HISTORY_SELECT_FIELDS,
          onProgress: trackProgress(`created-${index}`),
        })
        : [];

      const closedTasks = closedCount
        ? await bitrixApi.searchTasks({
          groupId: props.groupId,
          status: 'closed',
          closedDateFrom: formatDayStart(range.from),
          closedDateTo: formatDayEnd(range.to),
          selectFields: HISTORY_SELECT_FIELDS,
          onProgress: trackProgress(`closed-${index}`),
        })
        : [];

      const normalizedClosed = closedTasks.map(normalizeTask);
      collectUserNames(normalizedClosed, userNames);

      // Старые агрегаты диапазона стираем до записи новых: у дня, потерявшего всю активность
      // (отменили завершение задачи, дата закрытия переехала), новых данных не будет вовсе —
      // Object.assign его не перезаписал бы, и в кэше осталось бы закрытие, которого больше нет
      const rangeDayKeys = getDayKeys([dayjs(range.from).toDate(), dayjs(range.to).toDate()]);
      rangeDayKeys.forEach((dayKey) => { delete days[dayKey]; });

      Object.assign(days, buildDayAggregates(createdTasks.map(normalizeTask), normalizedClosed));
      markDaysCovered(days, rangeDayKeys);
    }

    // История готова — публикуем её сразу, не дожидаясь среза: графики и сводка рисуются, а блок
    // «сейчас» показывает загрузку и наполняется, когда придёт срез
    dayAggregates.value = days;
    taskUserNames.value = userNames;
    fetchedDateRange.value = [...form.dateRange];
    fetchedCompareRange.value = compareRequestRange;
    isLoading.value = false;

    const currentSnapshot = await snapshotRequest;
    snapshot.value = currentSnapshot;

    // Если всё пришло из кэша, перезаписывать его нечем — а объём там измеряется сотнями килобайт
    if (ranges.length || needSnapshot) {
      await saveCache(props.groupId, {days, users: userNames, snapshot: currentSnapshot});
      await refreshCacheSize();
    }
  } catch (e) {
    console.warn(e);
    showToast({
      severity: 'error',
      summary: 'Ошибка загрузки',
      detail: e.message,
      life: 8000,
    });
  } finally {
    isLoading.value = false;
  }
}

const metricsOptions = computed(() => ({
  cut: form.cut,
  contributionThresholdPercent: settings.value.contributionThresholdPercent ?? DEFAULT_SETTINGS.contributionThresholdPercent,
  excludedUserIds: settings.value.excludedUserIds ?? [],
}));

function countMonths(dateRange) {
  if (!dateRange?.[0]) return 1;
  return Math.max(1, dayjs(dateRange[1] ?? dateRange[0]).diff(dayjs(dateRange[0]), 'month', true));
}

const summary = computed(() => {
  if (!fetchedDateRange.value) return null;
  return computeMetrics(dayAggregates.value, getDayKeys(fetchedDateRange.value), {
    ...metricsOptions.value,
    periodMonths: countMonths(fetchedDateRange.value),
  });
});

const compareSummary = computed(() => {
  // Галку сняли — дельты убираем сразу, не дожидаясь перезагрузки: данные уже загружены, но сравнивать
  // пользователь больше не просил
  if (!form.compareEnabled || !fetchedCompareRange.value) return null;
  return computeMetrics(dayAggregates.value, getDayKeys(fetchedCompareRange.value), {
    ...metricsOptions.value,
    periodMonths: countMonths(fetchedCompareRange.value),
  });
});

const buckets = computed(() => buildBuckets(fetchedDateRange.value));

const bucketRows = computed(() => computeBucketRows(dayAggregates.value, buckets.value, {
  ...metricsOptions.value,
  memberIds: summary.value?.team?.memberIds ?? null,
}));

// «Качество» общий разрез игнорирует: при разрезе «только хотфиксы» их доля стала бы 100%
const qualityRows = computed(() => (form.cut === 'all'
  ? bucketRows.value
  : computeBucketRows(dayAggregates.value, buckets.value, {...metricsOptions.value, cut: 'all'})));

const backlog = computed(() => {
  if (!snapshot.value?.stages) return null;
  return computeBacklogSnapshot(snapshot.value.stages, {
    backlogStageIds: settings.value.backlogStageIds ?? [],
    excludedStageIds: settings.value.excludedStageIds ?? [],
    stages: stages.value,
  });
});

const milestoneMarkers = computed(() => mapMilestonesToBuckets(milestones.value, buckets.value));

const milestoneComparison = computed(() => {
  if (!form.milestoneDate || !fetchedDateRange.value) return null;
  const milestone = milestones.value.find((item) => item.date === form.milestoneDate);
  if (!milestone) return null;

  const periodDayKeys = getDayKeys(fetchedDateRange.value);
  const beforeDayKeys = periodDayKeys.filter((dayKey) => dayKey < milestone.date);
  const afterDayKeys = periodDayKeys.filter((dayKey) => dayKey >= milestone.date);
  if (!beforeDayKeys.length || !afterDayKeys.length) return null;

  const buildHalf = (dayKeys) => computeMetrics(dayAggregates.value, dayKeys, {
    ...metricsOptions.value,
    periodMonths: dayKeys.length / 30.44,
  });

  return {
    label: milestone.label || 'событие',
    date: milestone.date,
    before: buildHalf(beforeDayKeys),
    after: buildHalf(afterDayKeys),
  };
});

const userNames = computed(() => {
  const names = {...taskUserNames.value};
  groupUsers.value.forEach((user) => { names[user.id] = user.name; });
  return names;
});

const hasBacklogColumns = computed(() => (settings.value.backlogStageIds ?? []).length > 0);

const isEmptyPeriod = computed(() => !!summary.value && summary.value.created === 0 && summary.value.closed === 0);

const isRangeStale = computed(() => {
  if (!fetchedDateRange.value || !form.dateRange?.[0]) return false;
  const isSameRange = dayjs(form.dateRange[0]).isSame(dayjs(fetchedDateRange.value[0]), 'day')
    && dayjs(form.dateRange[1] ?? form.dateRange[0]).isSame(dayjs(fetchedDateRange.value[1] ?? fetchedDateRange.value[0]), 'day');
  // Выключенное сравнение устаревшим не считается: лишние загруженные дни ничему не мешают,
  // догружать нечего
  const compareRequestRange = getActiveCompareRange();
  const isCompareLoaded = !compareRequestRange
    || (fetchedCompareRange.value
      && dayjs(compareRequestRange[0]).isSame(dayjs(fetchedCompareRange.value[0]), 'day')
      && dayjs(compareRequestRange[1]).isSame(dayjs(fetchedCompareRange.value[1]), 'day'));
  return !isSameRange || !isCompareLoaded;
});

async function loadSettings() {
  const stored = await chrome.storage.local.get([settingsStorageKey]);
  if (!stored[settingsStorageKey]) return false;
  settings.value = {...DEFAULT_SETTINGS, ...stored[settingsStorageKey]};
  return true;
}

function onSaveSettings(newSettings) {
  settings.value = {...DEFAULT_SETTINGS, ...newSettings};
  isSettingsOpened.value = false;
  // Разметка колонок и пороги считаются на клиенте по уже загруженным данным — перезапрос не нужен
  form.milestoneDate = milestones.value.some((milestone) => milestone.date === form.milestoneDate)
    ? form.milestoneDate
    : null;
}

/** Колонки канбана и участники группы: нужны названиям колонок и мультиселекту исключений, но не расчётам. */
async function loadReferenceData(hasStoredSettings) {
  const [stagesResponse, users] = await Promise.all([
    bitrixApi.getStages(props.groupId),
    bitrixApi.getGroupUsers(props.groupId),
  ]);

  stages.value = Object.values(stagesResponse.data?.result ?? {}).sort((a, b) => a.SORT - b.SORT);
  groupUsers.value = users.map((user) => ({
    id: String(user.ID),
    name: [user.NAME, user.LAST_NAME].filter(Boolean).join(' ') || `ID ${user.ID}`,
    photo: user.PERSONAL_PHOTO || null,
  }));

  // Первая колонка канбана (SYSTEM_TYPE: NEW) есть в любой группе и почти всегда и есть бэклог —
  // с этим дефолтом срез «сейчас» работает сразу, без похода в настройки
  if (!hasStoredSettings) {
    settings.value = {
      ...settings.value,
      backlogStageIds: stages.value.filter((stage) => stage.SYSTEM_TYPE === 'NEW').map((stage) => String(stage.ID)),
    };
  }
}

onMounted(async () => {
  const hasStoredSettings = await loadSettings();
  applyDefaults();
  isInitialLoading.value = false;

  // Справочники расчётам не нужны, поэтому грузятся параллельно с данными: иначе при полностью
  // закэшированном периоде виджет всё равно ждал бы три запроса, прежде чем что-то показать
  // Без колонок метрики считаются как есть, поэтому ошибка справочников виджет не ломает
  const referenceRequest = loadReferenceData(hasStoredSettings).catch((e) => {
    console.warn(e);
    showToast({
      severity: 'warn',
      summary: 'Колонки канбана не загрузились',
      detail: 'Срез «сейчас» покажет ID колонок вместо названий.',
      life: 5000,
    });
  });

  await Promise.all([refreshCacheSize(), fetchData(), referenceRequest]);
});
</script>

<template>
  <div class="min-w-[1000px]">
    <template v-if="isInitialLoading">
      <Skeleton
        height="80px"
        class="mb-4"
      />
      <Skeleton height="300px" />
    </template>

    <template v-else>
      <div class="flex gap-2 mb-3">
        <Button
          label="Настройки"
          size="small"
          severity="secondary"
          icon="pi pi-cog"
          variant="text"
          @click="isSettingsOpened = true"
        />
        <Button
          v-if="cacheSizeBytes > 0"
          v-tooltip="'Виджет сохраняет итоги по дням, чтобы повторное открытие за тот же период не выкачивало историю заново. Кнопка удаляет их для этой группы — цифры на экране останутся, но следующая загрузка будет полной.'"
          :label="`Сбросить кэш (${cacheSizeLabel})`"
          size="small"
          severity="secondary"
          icon="pi pi-trash"
          variant="text"
          @click="resetCache"
        />
      </div>

      <div class="grid grid-cols-3 gap-3 items-end mb-3">
        <FormField
          label="Период"
          tip="Создание задач считается по дате создания, закрытия, баллы и время — по дате закрытия, возраст задач в планах — срезом на сейчас."
        >
          <DateRangePicker v-model="form.dateRange" />
        </FormField>

        <FormField
          label="Сравнить с"
          tip="По умолчанию — предыдущий период такой же длины. Снимите галку, чтобы не загружать сравнительный период: тогда дельты не показываются, а данных загружается вдвое меньше."
        >
          <InputGroup>
            <InputGroupAddon>
              <Checkbox
                v-model="form.compareEnabled"
                binary
                size="small"
              />
            </InputGroupAddon>
            <DateRangePicker
              :model-value="form.compareDateRange"
              :disabled="!form.compareEnabled"
              @update:model-value="onCompareDateRangeUpdate"
            />
          </InputGroup>
        </FormField>

        <FormField
          label="Разрез"
          tip="Общий для всех вкладок, кроме «Качества»: она всегда считается по всем задачам."
        >
          <Select
            v-model="form.cut"
            :options="CUT_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
            fluid
          />
        </FormField>
      </div>

      <div class="flex gap-3 items-end mb-3 flex-wrap">
        <FormField
          label="Сравнить до и после события"
          tip="События задаются в настройках виджета. Каждое рисуется вертикальной линией на всех графиках, а выбранное делит период на «до» и «после»."
        >
          <Select
            v-model="form.milestoneDate"
            :options="milestoneOptions"
            option-label="label"
            option-value="value"
            size="small"
            :disabled="!milestones.length"
            :placeholder="milestones.length ? 'Не сравнивать' : 'Событий пока нет'"
            class="w-[280px]"
          />
        </FormField>

        <FormField
          label="Значения"
          tip="Переключает распределение размеров задач и воронку планов между количеством задач и долями."
        >
          <SelectButton
            v-model="form.valueMode"
            :options="VALUE_MODE_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
            :allow-empty="false"
          />
        </FormField>

        <Button
          :label="loadButtonLabel"
          :loading="isLoading"
          icon="pi pi-refresh"
          size="small"
          @click="fetchData({force: true})"
        />
      </div>

      <ProgressBar
        v-if="isLoading && progressPercent !== null"
        :value="progressPercent"
        class="mb-3"
      />

      <Message
        v-if="isRangeStale && !isLoading"
        severity="info"
        :closable="false"
        class="mb-3"
      >
        Период изменён — нажмите «Обновить», чтобы загрузить данные за новый диапазон.
      </Message>

      <Message
        v-if="isEmptyPeriod"
        severity="warn"
        :closable="false"
        class="mb-3"
      >
        За выбранный период в группе нет ни созданных, ни закрытых задач. Проверьте диапазон — или, если
        группа новая, начните с более широкого периода.
      </Message>

      <DynamicsTabs
        v-if="summary"
        :default-tab="settings.defaultTab ?? 'summary'"
        :summary="summary"
        :compare-summary="compareSummary"
        :bucket-rows="bucketRows"
        :quality-rows="qualityRows"
        :backlog="backlog"
        :snapshot-at="snapshot?.at ?? null"
        :snapshot-loading="isSnapshotLoading"
        :has-backlog-columns="hasBacklogColumns"
        :milestone-markers="milestoneMarkers"
        :milestone-comparison="milestoneComparison"
        :milestones="milestones"
        :user-names="userNames"
        :group-id="groupId"
        :date-range="fetchedDateRange"
        :compare-date-range="fetchedCompareRange"
        :cut="form.cut"
        :value-mode="form.valueMode"
        :contribution-threshold-percent="metricsOptions.contributionThresholdPercent"
        :copy-separator="settings.copySeparator ?? '\t'"
        :csv-separator="settings.csvSeparator ?? ','"
        @open-settings="isSettingsOpened = true"
      />
    </template>
  </div>

  <Dialog
    v-model:visible="isSettingsOpened"
    header="Настройки"
    dismissable-mask
    modal
  >
    <SettingsForm
      :stages="stages"
      :users="groupUsers"
      :initial="settings"
      :settings-storage-key="settingsStorageKey"
      @success="onSaveSettings"
    />
  </Dialog>

  <Dialog
    :visible="!!pendingConfirmation"
    header="Загрузить много задач?"
    modal
    :closable="false"
    :style="{width: '460px'}"
  >
    <p class="text-sm text-surface-700 dark:text-surface-0 mb-2">
      За выбранный диапазон будет загружено примерно
      <b>{{ pendingConfirmation?.taskCount }}</b>
      {{ pluralize(pendingConfirmation?.taskCount ?? 0, ['задача', 'задачи', 'задач']) }}.
    </p>
    <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
      Bitrix отдаёт задачи страницами по 50, поэтому это займёт время, а сам Bitrix может ненадолго
      ограничить частоту запросов. Загруженные дни сохраняются, так что следующее открытие за тот же
      период будет быстрым. Сократить ожидание можно более узким периодом или снятой галкой
      у «Сравнить с» — она вдвое уменьшает объём.
    </p>
    <div class="flex gap-2 justify-end">
      <Button
        label="Отмена"
        size="small"
        severity="secondary"
        variant="text"
        @click="resolveConfirmation(false)"
      />
      <Button
        label="Загрузить"
        size="small"
        icon="pi pi-download"
        @click="resolveConfirmation(true)"
      />
    </div>
  </Dialog>
</template>
