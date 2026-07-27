<script setup>
import dayjs from 'dayjs';
import {orderBy} from 'lodash-es';
import {
  Avatar,
  Button,
  Checkbox,
  Dialog,
  InputGroup,
  InputGroupAddon,
  MultiSelect,
  Select,
  Skeleton,
} from 'primevue';
import {computed, onMounted, reactive, ref, watch} from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import {showToast} from '../../../toastHost/showToast.js';
import DateRangePicker from '../../../ui/DateRangePicker.vue';
import FormField from '../../../ui/FormField.vue';
import {
  computeDefaultCompareRange,
  getCompareRequestRange,
  getDistinctLineStyleIndexes,
  getTaskPointsFromName,
  getTaskUrl,
  isHotfixTask,
  stringToPastelColor,
} from '../../../utils.js';
import SettingsForm from './SettingsForm.vue';
import TaskAnalysisTabs from './TaskAnalysisTabs.vue';

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

const groupFilterOptions = [
  {label: 'Текущая группа', value: 'current'},
  {label: 'Все задачи', value: 'all'},
];

// Пары стилей линии «баллы»/«задачи» для графика «Динамика» — индекс подбирается по коллизии цвета (getDistinctLineStyleIndexes)
const POINTS_LINE_DASHES = [[], [2, 2], [8, 4], [1, 4]];
const TASKS_LINE_DASHES = [[5, 5], [8, 2, 2, 2], [2, 2], [8, 3]];


const settingsStorageKey = `task-analysis-settings-${props.groupId}`;
const settings = ref({});
const isSettingsOpened = ref(false);

function getDefaults() {
  const savedSettings = settings.value;
  const months = savedSettings.defaultMonths ?? 1;
  let userIds = props.options?.userId ? [String(props.options.userId)] : [];
  if (savedSettings.defaultUserIds?.length) userIds = savedSettings.defaultUserIds;
  else if (savedSettings.defaultUserId != null) userIds = [savedSettings.defaultUserId];
  const dateRange = [dayjs().subtract(months, 'month').toDate(), dayjs().toDate()];
  return {
    dateRange,
    compareDateRange: computeDefaultCompareRange(dateRange),
    compareEnabled: savedSettings.defaultCompareEnabled ?? true,
    selectedUserIds: userIds,
    includeHotfixes: savedSettings.defaultIncludeHotfixes ?? true,
  };
}

const form = reactive({...getDefaults(), groupFilter: 'current'});

// «Сравнить с» подстраивается под «Период», пока пользователь не выбрал диапазон сравнения вручную
const compareRangeTouched = ref(false);

watch(() => form.dateRange, (newRange) => {
  if (compareRangeTouched.value) return;
  form.compareDateRange = computeDefaultCompareRange(newRange);
});

function onCompareDateRangeUpdate(value) {
  form.compareDateRange = value;
  compareRangeTouched.value = true;
}

function applyDefaults() {
  Object.assign(form, getDefaults());
  compareRangeTouched.value = false;
}

const users = ref([]);
const visibleUsers = computed(() => {
  const ids = settings.value.visibleUserIds;
  if (!ids?.length) return users.value;
  return users.value.filter((user) => ids.includes(user.id));
});
const isInitialLoading = ref(true);
const isLoading = ref(false);
const rows = ref([]);
const prevRows = ref([]);
const allUserTasksPerUser = ref([]);
const prevUserTasksPerUser = ref([]);
const fetchedDateRange = ref(null);
const fetchedCompareRange = ref(null);
const MIN_POINTS = 1;
const filteredRows = computed(() => rows.value.filter((row) => row.totalPoints >= MIN_POINTS));

function stripHotfixes(rowsList) {
  return rowsList
    .map((row) => {
      const tasks = row.tasks.filter((task) => !isHotfixTask(task.title));
      const totalPoints = tasks.reduce((sum, task) => sum + task.points, 0);
      return {...row, tasks, totalPoints};
    })
    .filter((row) => row.totalPoints >= MIN_POINTS);
}

const displayRows = computed(() => (form.includeHotfixes ? filteredRows.value : stripHotfixes(filteredRows.value)));

// Галку «Сравнить с» сняли — дельты убираем сразу, не дожидаясь повторной загрузки
const displayPrevRows = computed(() => {
  if (!form.compareEnabled) return [];
  return form.includeHotfixes
    ? prevRows.value.filter((row) => row.totalPoints >= MIN_POINTS)
    : stripHotfixes(prevRows.value);
});

const displayUserTasksPerUser = computed(() => {
  if (form.includeHotfixes) return allUserTasksPerUser.value;
  return allUserTasksPerUser.value.map(({userId, tasks}) => ({
    userId,
    tasks: tasks.filter((task) => !isHotfixTask(task.title)),
  }));
});

function countHotfixesByUser(userTasksList) {
  const counts = new Map();
  userTasksList.forEach(({userId, tasks}) => {
    counts.set(userId, tasks.filter((task) => isHotfixTask(task.title)).length);
  });
  return counts;
}

const summaryTableData = computed(() => {
  if (!filteredRows.value.length || !fetchedDateRange.value?.[0]) return null;

  const start = dayjs(fetchedDateRange.value[0]);
  const end = dayjs(fetchedDateRange.value[1] ?? fetchedDateRange.value[0]);
  const periodLength = Math.max(1, end.diff(start, 'month', true));

  // Задач всего/Баллов всего/Корневые/средние — зависят от галки «Учитывать хотфиксы в данных»
  const byUser = {};
  displayRows.value.forEach((row) => {
    if (!byUser[row.userId]) {
      byUser[row.userId] = {totalPoints: 0, totalTasks: 0, totalRoots: 0, pointCounts: {}, rootTasks: []};
    }
    const userSummary = byUser[row.userId];
    userSummary.totalPoints += row.totalPoints;
    userSummary.totalTasks += row.tasks.length;
    userSummary.totalRoots += 1;
    userSummary.rootTasks.push({title: row.title, points: row.totalPoints});
    row.tasks.forEach((task) => {
      if (task.points > 0) userSummary.pointCounts[task.points] = (userSummary.pointCounts[task.points] || 0) + 1;
    });
  });

  const prevByUser = {};
  displayPrevRows.value.forEach((row) => {
    if (!prevByUser[row.userId]) prevByUser[row.userId] = {totalPoints: 0, totalTasks: 0, totalRoots: 0, pointCounts: {}};
    prevByUser[row.userId].totalPoints += row.totalPoints;
    prevByUser[row.userId].totalTasks += row.tasks.length;
    prevByUser[row.userId].totalRoots += 1;
    row.tasks.forEach((task) => {
      if (task.points > 0) prevByUser[row.userId].pointCounts[task.points] = (prevByUser[row.userId].pointCounts[task.points] || 0) + 1;
    });
  });

  // Хотфиксы считаются по полному списку закрытых задач — всегда, независимо от галки выше
  const hotfixesByUser = countHotfixesByUser(allUserTasksPerUser.value);
  const hasPrevHotfixData = form.compareEnabled && prevUserTasksPerUser.value.length > 0;
  const prevHotfixesByUser = countHotfixesByUser(prevUserTasksPerUser.value);

  const userIds = new Set([...Object.keys(byUser), ...[...hotfixesByUser.entries()].filter(([, count]) => count > 0).map(([userId]) => userId)]);

  return {
    rows: [...userIds].map((userId) => {
      const userSummary = byUser[userId] ?? {totalPoints: 0, totalTasks: 0, totalRoots: 0, pointCounts: {}, rootTasks: []};
      const userName = users.value.find((user) => user.id === userId)?.name ?? userId;
      const totalHotfixes = hotfixesByUser.get(userId) ?? 0;
      const avgPoints = Math.round((userSummary.totalPoints / periodLength) * 10) / 10;
      const previousSummary = prevByUser[userId];
      const totalWithPoints = Object.values(userSummary.pointCounts).reduce((a, b) => a + b, 0);
      const pointDistribution = Object.entries(userSummary.pointCounts)
        .map(([pts, count]) => ({points: Number(pts), count, pct: totalWithPoints ? Math.round((count / totalWithPoints) * 100) : 0}))
        .sort((a, b) => a.points - b.points);
      const prevTotalWithPoints = previousSummary ? Object.values(previousSummary.pointCounts).reduce((a, b) => a + b, 0) : 0;
      const prevPointDistribution = previousSummary ? Object.entries(previousSummary.pointCounts)
        .map(([pts, count]) => ({points: Number(pts), count, pct: prevTotalWithPoints ? Math.round((count / prevTotalWithPoints) * 100) : 0}))
        .sort((a, b) => a.points - b.points) : null;
      const decompRatio = userSummary.totalRoots ? Math.round((userSummary.totalTasks / userSummary.totalRoots) * 10) / 10 : 0;
      const prevDecompRatio = previousSummary?.totalRoots ? previousSummary.totalTasks / previousSummary.totalRoots : 0;
      return {
        userId,
        userName,
        totalPoints: userSummary.totalPoints,
        totalTasks: userSummary.totalTasks,
        totalRoots: userSummary.totalRoots,
        totalHotfixes,
        decompRatio,
        avgPoints,
        avgPointsPerTask: userSummary.totalTasks ? Math.round((userSummary.totalPoints / userSummary.totalTasks) * 10) / 10 : 0,
        pointDistribution,
        prevPointDistribution,
        deltaTotal: previousSummary != null ? userSummary.totalPoints - previousSummary.totalPoints : null,
        deltaTotalTasks: previousSummary != null ? userSummary.totalTasks - previousSummary.totalTasks : null,
        deltaTotalRoots: previousSummary != null ? userSummary.totalRoots - previousSummary.totalRoots : null,
        deltaTotalHotfixes: hasPrevHotfixData ? totalHotfixes - (prevHotfixesByUser.get(userId) ?? 0) : null,
        deltaDecompRatio: previousSummary != null ? Math.round((decompRatio - prevDecompRatio) * 10) / 10 : null,
        deltaAvgPointsPerTask: previousSummary != null ? Math.round(((userSummary.totalTasks ? userSummary.totalPoints / userSummary.totalTasks : 0) - (previousSummary.totalTasks ? previousSummary.totalPoints / previousSummary.totalTasks : 0)) * 10) / 10 : null,
        deltaAvgPoints: previousSummary != null ? Math.round((avgPoints - Math.round((previousSummary.totalPoints / periodLength) * 10) / 10) * 10) / 10 : null,
        topTasks: [...userSummary.rootTasks].sort((a, b) => b.points - a.points).slice(0, 5),
      };
    }),
    total: buildSummaryTotal(byUser, prevByUser, hotfixesByUser, prevHotfixesByUser, hasPrevHotfixData, periodLength),
  };
});

function sumBy(summaries, key) {
  return summaries.reduce((sum, summary) => sum + summary[key], 0);
}

function sumCounts(countsByUser) {
  return [...countsByUser.values()].reduce((sum, count) => sum + count, 0);
}

function buildPointDistribution(pointCounts) {
  const totalWithPoints = Object.values(pointCounts).reduce((a, b) => a + b, 0);
  return Object.entries(pointCounts)
    .map(([pts, count]) => ({points: Number(pts), count, pct: totalWithPoints ? Math.round((count / totalWithPoints) * 100) : 0}))
    .sort((a, b) => a.points - b.points);
}

function buildSummaryTotal(byUser, prevByUser, hotfixesByUser, prevHotfixesByUser, hasPrevHotfixData, periodLength) {
  const userSummaries = Object.values(byUser);
  const totalPoints = sumBy(userSummaries, 'totalPoints');
  const totalTasks = sumBy(userSummaries, 'totalTasks');
  const totalRoots = sumBy(userSummaries, 'totalRoots');
  const totalHotfixes = sumCounts(hotfixesByUser);
  const totalPointCounts = {};
  userSummaries.forEach((summary) => {
    Object.entries(summary.pointCounts).forEach(([points, count]) => {
      totalPointCounts[points] = (totalPointCounts[points] || 0) + count;
    });
  });
  const decompRatio = totalRoots ? Math.round((totalTasks / totalRoots) * 10) / 10 : 0;
  const avgPointsPerTask = totalTasks ? Math.round((totalPoints / totalTasks) * 10) / 10 : 0;
  const avgPoints = Math.round((totalPoints / periodLength) * 10) / 10;

  const prevSummaries = Object.values(prevByUser);
  const hasPrev = prevSummaries.length > 0;
  const prevTotalPoints = sumBy(prevSummaries, 'totalPoints');
  const prevTotalTasks = sumBy(prevSummaries, 'totalTasks');
  const prevTotalRoots = sumBy(prevSummaries, 'totalRoots');
  const prevTotalHotfixes = sumCounts(prevHotfixesByUser);
  const prevDecompRatio = prevTotalRoots ? prevTotalTasks / prevTotalRoots : 0;
  const prevAvgPointsPerTask = prevTotalTasks ? prevTotalPoints / prevTotalTasks : 0;
  const prevAvgPoints = prevTotalPoints / periodLength;
  const prevPointCounts = {};
  prevSummaries.forEach((summary) => {
    Object.entries(summary.pointCounts).forEach(([points, count]) => {
      prevPointCounts[points] = (prevPointCounts[points] || 0) + count;
    });
  });

  return {
    totalPoints,
    totalTasks,
    totalRoots,
    totalHotfixes,
    decompRatio,
    avgPointsPerTask,
    avgPoints,
    pointDistribution: buildPointDistribution(totalPointCounts),
    prevPointDistribution: hasPrev ? buildPointDistribution(prevPointCounts) : null,
    deltaTotal: hasPrev ? totalPoints - prevTotalPoints : null,
    deltaTotalTasks: hasPrev ? totalTasks - prevTotalTasks : null,
    deltaTotalRoots: hasPrev ? totalRoots - prevTotalRoots : null,
    deltaTotalHotfixes: hasPrevHotfixData ? totalHotfixes - prevTotalHotfixes : null,
    deltaDecompRatio: hasPrev ? Math.round((decompRatio - prevDecompRatio) * 10) / 10 : null,
    deltaAvgPointsPerTask: hasPrev ? Math.round((avgPointsPerTask - prevAvgPointsPerTask) * 10) / 10 : null,
    deltaAvgPoints: hasPrev ? Math.round((avgPoints - prevAvgPoints) * 10) / 10 : null,
  };
}

const topTasksData = computed(() => {
  if (!displayRows.value.length || !fetchedDateRange.value?.[0]) return null;

  const byTask = {};
  displayRows.value.forEach((row) => {
    if (!byTask[row.id]) {
      byTask[row.id] = {key: row.id, title: row.title, url: row.url, totalPoints: 0, users: new Map(), tasks: []};
    }
    byTask[row.id].totalPoints += row.totalPoints;
    byTask[row.id].tasks.push(...row.tasks.map((task) => ({
      ...task,
      responsible: {name: row.userName, url: `/company/personal/user/${row.userId}/`},
    })));
    if (!byTask[row.id].users.has(row.userId)) {
      byTask[row.id].users.set(row.userId, {id: row.userId, name: row.userName, url: `/company/personal/user/${row.userId}/`});
    }
  });

  const top = Object.values(byTask).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 10);

  return {
    rows: top.map((row) => ({
      key: row.key,
      title: row.title,
      url: row.url,
      totalPoints: row.totalPoints,
      users: [...row.users.values()],
      tasks: row.tasks,
    })),
  };
});

const timelineChartData = computed(() => {
  if (!displayUserTasksPerUser.value.length || !fetchedDateRange.value?.[0]) return null;

  const start = dayjs(fetchedDateRange.value[0]);
  const end = dayjs(fetchedDateRange.value[1] ?? fetchedDateRange.value[0]);

  const buckets = [];
  let currentBucket = start.startOf('month');
  const endBucket = end.startOf('month');
  while (currentBucket.valueOf() <= endBucket.valueOf()) {
    buckets.push(currentBucket.format('YYYY-MM'));
    currentBucket = currentBucket.add(1, 'month');
  }
  if (!buckets.length) return null;

  const multiUser = displayUserTasksPerUser.value.length > 1;

  // Индекс подбирается по коллизии цвета между пользователями (см. getDistinctLineStyleIndexes) —
  // у большинства пользователей index=0 (баллы: сплошная, задачи: пунктирная — как раньше),
  // конфликтующим по цвету парам достаётся другой индекс, т.е. другая пара стилей линии.
  const userColors = displayUserTasksPerUser.value.map(({userId}) => stringToPastelColor(users.value.find((user) => user.id === userId)?.name ?? userId));
  const lineStyleIndexes = getDistinctLineStyleIndexes(userColors);

  const datasets = displayUserTasksPerUser.value.flatMap(({userId, tasks}, userIndex) => {
    const userName = users.value.find((user) => user.id === userId)?.name ?? userId;
    const color = userColors[userIndex];
    const styleIndex = lineStyleIndexes[userIndex];

    const pointsByBucket = Object.fromEntries(buckets.map((bucket) => [bucket, 0]));
    const countByBucket = Object.fromEntries(buckets.map((bucket) => [bucket, 0]));
    tasks.forEach((task) => {
      if (!task.closedDate) return;
      const key = dayjs(task.closedDate).format('YYYY-MM');
      if (!(key in pointsByBucket)) return;
      pointsByBucket[key] += getTaskPointsFromName(task.title);
      countByBucket[key] += 1;
    });

    return [
      {
        label: multiUser ? `${userName} — баллы` : 'Баллы',
        data: buckets.map((bucket) => ({x: dayjs(bucket).format('MM.YYYY'), y: pointsByBucket[bucket]})),
        yAxisID: 'y',
        showLine: true,
        tension: 0.3,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: color,
        borderDash: POINTS_LINE_DASHES[styleIndex],
        pointStyle: 'circle',
        pointRadius: 3,
      },
      {
        label: multiUser ? `${userName} — задачи` : 'Задачи',
        data: buckets.map((bucket) => ({x: dayjs(bucket).format('MM.YYYY'), y: countByBucket[bucket]})),
        yAxisID: 'y1',
        showLine: true,
        tension: 0.3,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: color,
        borderDash: TASKS_LINE_DASHES[styleIndex],
        pointStyle: 'rectRot',
        pointRadius: 4,
      },
    ];
  });

  return {
    labels: buckets.map((bucket) => dayjs(bucket).format('MM.YYYY')),
    datasets,
  };
});

async function loadUsers() {
  const groupUsers = await bitrixApi.getGroupUsers(props.groupId);
  users.value = groupUsers.map((user) => ({
    id: String(user.ID),
    name: [user.NAME, user.LAST_NAME].filter(Boolean).join(' '),
    photo: user.PERSONAL_PHOTO || null,
  }));
}

function onSaveSettings(newSettings) {
  settings.value = newSettings;
  applyDefaults();
  isSettingsOpened.value = false;
}

function findRootId(taskId, taskMap) {
  let currentId = taskId;
  const visited = new Set();
  while (true) {
    if (visited.has(currentId)) return currentId;
    visited.add(currentId);
    const task = taskMap.get(currentId);
    if (!task) return currentId;
    const parentId = String(task.parentId ?? '0');
    if (!parentId || parentId === '0' || !taskMap.has(parentId)) return currentId;
    currentId = parentId;
  }
}

async function fetchUserData(userId, userName, dateFrom, dateTo, groupFilter) {
  const userTasks = await bitrixApi.searchTasks({
    groupId: groupFilter === 'current' ? props.groupId : null,
    responsibleId: userId,
    closedDateFrom: dateFrom,
    closedDateTo: dateTo,
    status: 'closed',
  });

  const taskMap = new Map(userTasks.map((task) => [String(task.id), task]));

  let unknownParentIds = new Set();
  taskMap.forEach((task) => {
    const parentId = String(task.parentId ?? '0');
    if (parentId !== '0' && !taskMap.has(parentId)) unknownParentIds.add(parentId);
  });

  while (unknownParentIds.size > 0) {
    const parents = await bitrixApi.searchTasks({ids: [...unknownParentIds]});
    const nextUnknown = new Set();
    parents.forEach((parentTask) => {
      const parentId = String(parentTask.id);
      taskMap.set(parentId, parentTask);
      const grandParentId = String(parentTask.parentId ?? '0');
      if (grandParentId !== '0' && !taskMap.has(grandParentId)) nextUnknown.add(grandParentId);
    });
    unknownParentIds = nextUnknown;
  }

  const rootMap = new Map();

  userTasks.forEach((task) => {
    const taskId = String(task.id);
    const rootId = findRootId(taskId, taskMap);
    const rootTask = taskMap.get(rootId);
    const points = getTaskPointsFromName(task.title);

    if (!rootMap.has(rootId)) {
      rootMap.set(rootId, {
        key: `${userId}-${rootId}`,
        id: rootId,
        userId,
        userName,
        title: rootTask?.title ?? `Задача #${rootId}`,
        url: getTaskUrl(props.groupId, rootId),
        createdDate: rootTask?.createdDate ?? null,
        closedDate: rootTask?.closedDate ?? null,
        maxDate: rootTask?.closedDate ?? null,
        totalPoints: 0,
        tasks: [],
      });
    }

    const entry = rootMap.get(rootId);
    entry.totalPoints += points;
    if (task.closedDate && (!entry.maxDate || task.closedDate > entry.maxDate)) {
      entry.maxDate = task.closedDate;
    }
    entry.tasks.push({
      id: task.id,
      title: task.title,
      url: getTaskUrl(props.groupId, task.id),
      closedDate: task.closedDate ?? null,
      points,
      isRootTask: String(task.parentId ?? 0) === '0',
    });
  });

  return {userId, tasks: userTasks, rows: [...rootMap.values()]};
}

async function fetchData() {
  if (!form.dateRange?.[0] || !form.selectedUserIds.length) return;

  isLoading.value = true;
  rows.value = [];
  allUserTasksPerUser.value = [];
  prevRows.value = [];
  prevUserTasksPerUser.value = [];
  fetchedDateRange.value = [...form.dateRange];
  fetchedCompareRange.value = null;

  try {
    const dateFrom = dayjs(form.dateRange[0]).format('YYYY-MM-DD 00:00:00');
    const dateTo = dayjs(form.dateRange[1] ?? form.dateRange[0]).format('YYYY-MM-DD 23:59:59');

    const results = await Promise.all(
      form.selectedUserIds.map((userId) => {
        const userName = users.value.find((user) => user.id === userId)?.name ?? userId;
        return fetchUserData(userId, userName, dateFrom, dateTo, form.groupFilter);
      }),
    );

    allUserTasksPerUser.value = results.map((result) => ({userId: result.userId, tasks: result.tasks}));
    rows.value = orderBy(
      results.flatMap((result) => result.rows),
      ['totalPoints'],
      ['desc'],
    );

    const compareRequestRange = form.compareEnabled
      ? getCompareRequestRange(form.compareDateRange, form.dateRange)
      : null;
    fetchedCompareRange.value = compareRequestRange;
    if (compareRequestRange) {
      const compareDateFrom = dayjs(compareRequestRange[0]).format('YYYY-MM-DD 00:00:00');
      const compareDateTo = dayjs(compareRequestRange[1]).format('YYYY-MM-DD 23:59:59');
      const prevResults = await Promise.all(
        form.selectedUserIds.map((userId) => {
          const userName = users.value.find((user) => user.id === userId)?.name ?? userId;
          return fetchUserData(userId, userName, compareDateFrom, compareDateTo, form.groupFilter);
        }),
      );
      prevUserTasksPerUser.value = prevResults.map((result) => ({userId: result.userId, tasks: result.tasks}));
      prevRows.value = prevResults.flatMap((result) => result.rows);
    }
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

onMounted(async () => {
  const [, stored] = await Promise.all([
    loadUsers(),
    chrome.storage.local.get([settingsStorageKey]),
  ]);
  if (stored[settingsStorageKey]) {
    settings.value = stored[settingsStorageKey];
    applyDefaults();
  }
  isInitialLoading.value = false;
  fetchData();
});
</script>

<template>
  <div class="min-w-[1000px]">
    <template v-if="isInitialLoading">
      <Skeleton
        height="100px"
        class="mb-4"
      />
      <Skeleton
        height="100px"
        class="mb-4"
      />
      <Skeleton height="200px" />
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
      </div>
      <div class="flex flex-col gap-3 mb-3">
        <div class="grid grid-cols-4 gap-3 items-end">
          <FormField label="Период">
            <DateRangePicker v-model="form.dateRange" />
          </FormField>

          <FormField
            label="Сравнить с"
            tip="По умолчанию — предыдущий период такой же длины, подстраивается под «Период». Можно выбрать любой диапазон вручную. Снимите галку, чтобы не загружать сравнительный период: тогда дельты не показываются, а загрузка идёт вдвое быстрее."
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

          <FormField label="Исполнители">
            <MultiSelect
              v-model="form.selectedUserIds"
              :options="visibleUsers"
              option-label="name"
              option-value="id"
              placeholder="Выберите исполнителей"
              :max-selected-labels="1"
              filter
              filter-placeholder="Поиск"
              size="small"
              fluid
            >
              <template #option="{ option }">
                <div class="flex gap-2 items-center">
                  <Avatar
                    v-if="option.photo"
                    :image="option.photo"
                    shape="circle"
                    size="small"
                  />
                  {{ option.name }}
                </div>
              </template>
            </MultiSelect>
          </FormField>

          <FormField label="Группа">
            <Select
              v-model="form.groupFilter"
              :options="groupFilterOptions"
              option-label="label"
              option-value="value"
              size="small"
              fluid
            />
          </FormField>
        </div>

        <div class="flex gap-3 items-center flex-wrap">
          <Button
            label="Загрузить"
            :loading="isLoading"
            icon="pi pi-search"
            size="small"
            @click="fetchData"
          />
        </div>
      </div>

      <div class="flex gap-2 items-center mb-4 border-t border-surface-200 dark:border-surface-700 pt-3">
        <Checkbox
          v-model="form.includeHotfixes"
          binary
          input-id="task-analysis-include-hotfixes"
        />
        <label
          for="task-analysis-include-hotfixes"
          class="text-sm cursor-pointer"
        >
          Учитывать хотфиксы в данных
          <i
            v-tooltip="'Учитывает задачи с «Hotfix» в названии в общих показателях — «Задач всего», «Баллов всего», «Корневые», средние и коэф. декомпозиции — на всех вкладках.\nКолонка «Хотфиксы» на «Сводке» считается отдельно и не зависит от этой настройки.'"
            class="pi pi-question-circle text-surface-400 dark:text-surface-500"
          />
        </label>
      </div>

      <TaskAnalysisTabs
        v-if="displayUserTasksPerUser.length"
        :timeline-chart-data="timelineChartData"
        :all-user-tasks-per-user="displayUserTasksPerUser"
        :users="users"
        :summary-table-data="summaryTableData"
        :top-tasks-data="topTasksData"
        :all-rows="displayRows"
        :is-loading="isLoading"
        :multi-user="allUserTasksPerUser.length > 1"
        :copy-separator="settings.copySeparator ?? '\t'"
        :csv-separator="settings.csvSeparator ?? ','"
        :default-tab="settings.defaultTab ?? 'summary'"
        :group-id="groupId"
        :date-range="fetchedDateRange"
        :compare-date-range="form.compareEnabled ? fetchedCompareRange : null"
        class="mb-4"
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
      :users
      :initial="settings"
      :settings-storage-key="settingsStorageKey"
      @success="onSaveSettings"
    />
  </Dialog>
</template>
