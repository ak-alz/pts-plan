<script setup>
import dayjs from 'dayjs';
import {orderBy} from 'lodash-es';
import {Avatar, Button, Column, DataTable, DatePicker, Dialog, MultiSelect, Select, Skeleton, ToggleSwitch} from 'primevue';
import {useToast} from 'primevue/usetoast';
import {computed, onMounted, reactive, ref} from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import FormField from '../../../ui/FormField.vue';
import {getTaskPointsFromName, getTaskUrl, stringToPastelColor} from '../../../utils.js';
import SettingsForm from './SettingsForm.vue';
import TaskCharts from './TaskCharts.vue';
import TaskList from './TaskList.vue';

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

const toast = useToast();
const bitrixApi = new BitrixApi(props.sessionId);

const groupFilterOptions = [
  {label: 'Текущая группа', value: 'current'},
  {label: 'Все задачи', value: 'all'},
];

const datePresets = [
  {label: '1м', months: 1, tooltip: 'Последний месяц'},
  {label: '2м', months: 2, tooltip: 'Последние 2 месяца'},
  {label: '3м', months: 3, tooltip: 'Последние 3 месяца'},
  {label: '6м', months: 6, tooltip: 'Последние 6 месяцев'},
  {label: '12м', months: 12, tooltip: 'Последние 12 месяцев'},
];

const settingsStorageKey = `task-analysis-settings-${props.groupId}`;
const settings = ref({});
const isSettingsOpened = ref(false);

function getDefaults() {
  const s = settings.value;
  const months = s.defaultMonths ?? 1;
  let userIds = props.options?.userId ? [String(props.options.userId)] : [];
  if (s.defaultUserIds?.length) userIds = s.defaultUserIds;
  else if (s.defaultUserId != null) userIds = [s.defaultUserId];
  return {
    dateRange: [dayjs().subtract(months, 'month').toDate(), dayjs().toDate()],
    selectedUserIds: userIds,
    statusFilter: s.defaultStatus || 'closed',
    compareWithPrev: s.defaultCompareWithPrev ?? false,
  };
}

const form = reactive({...getDefaults(), groupFilter: 'current'});

function applyPreset(months) {
  form.dateRange = [dayjs().subtract(months, 'month').toDate(), dayjs().toDate()];
}

const users = ref([]);
const visibleUsers = computed(() => {
  const ids = settings.value.visibleUserIds;
  if (!ids?.length) return users.value;
  return users.value.filter((u) => ids.includes(u.id));
});
const isInitialLoading = ref(true);
const isLoading = ref(false);
const rows = ref([]);
const prevRows = ref([]);
const allUserTasksPerUser = ref([]);
const MIN_POINTS = 1;
const filteredRows = computed(() => rows.value.filter((r) => r.totalPoints >= MIN_POINTS));

const useWeeks = computed(() => {
  if (!form.dateRange?.[0]) return false;
  const start = dayjs(form.dateRange[0]);
  const end = dayjs(form.dateRange[1] ?? form.dateRange[0]);
  return end.diff(start, 'day') <= 60;
});

const summaryTableData = computed(() => {
  if (!filteredRows.value.length || !form.dateRange?.[0]) return null;

  const start = dayjs(form.dateRange[0]);
  const end = dayjs(form.dateRange[1] ?? form.dateRange[0]);
  const periodLength = useWeeks.value
    ? Math.max(1, end.diff(start, 'week', true))
    : Math.max(1, end.diff(start, 'month', true));
  const weeksLength = Math.max(1, end.diff(start, 'week', true));

  const byUser = {};
  filteredRows.value.forEach((row) => {
    if (!byUser[row.userId]) {
      byUser[row.userId] = {userId: row.userId, userName: row.userName, totalPoints: 0, totalTasks: 0, pointCounts: {}};
    }
    const u = byUser[row.userId];
    u.totalPoints += row.totalPoints;
    u.totalTasks += row.tasks.length;
    row.tasks.forEach((task) => {
      if (task.points > 0) u.pointCounts[task.points] = (u.pointCounts[task.points] || 0) + 1;
    });
  });

  const prevByUser = {};
  prevRows.value.filter((r) => r.totalPoints >= MIN_POINTS).forEach((row) => {
    if (!prevByUser[row.userId]) prevByUser[row.userId] = {totalPoints: 0, totalTasks: 0};
    prevByUser[row.userId].totalPoints += row.totalPoints;
    prevByUser[row.userId].totalTasks += row.tasks.length;
  });

  return {
    rows: Object.values(byUser).map((u) => {
      const avgPoints = Math.round((u.totalPoints / periodLength) * 10) / 10;
      const avgPointsPerWeek = Math.round((u.totalPoints / weeksLength) * 10) / 10;
      const prev = prevByUser[u.userId];
      const totalWithPoints = Object.values(u.pointCounts).reduce((a, b) => a + b, 0);
      const pointDistribution = Object.entries(u.pointCounts)
        .map(([pts, count]) => ({points: Number(pts), count, pct: totalWithPoints ? Math.round((count / totalWithPoints) * 100) : 0}))
        .sort((a, b) => a.points - b.points);
      return {
        userId: u.userId,
        userName: u.userName,
        totalPoints: u.totalPoints,
        totalTasks: u.totalTasks,
        avgPoints,
        avgPointsPerTask: u.totalTasks ? Math.round((u.totalPoints / u.totalTasks) * 10) / 10 : 0,
        avgPointsPerWeek,
        pointDistribution,
        deltaTotal: prev != null ? u.totalPoints - prev.totalPoints : null,
        deltaTotalTasks: prev != null ? u.totalTasks - prev.totalTasks : null,
        deltaAvgPointsPerTask: prev != null ? Math.round(((u.totalTasks ? u.totalPoints / u.totalTasks : 0) - (prev.totalTasks ? prev.totalPoints / prev.totalTasks : 0)) * 10) / 10 : null,
        deltaAvgPoints: prev != null ? Math.round((avgPoints - Math.round((prev.totalPoints / periodLength) * 10) / 10) * 10) / 10 : null,
        deltaAvgPointsPerWeek: prev != null ? Math.round((avgPointsPerWeek - Math.round((prev.totalPoints / weeksLength) * 10) / 10) * 10) / 10 : null,
      };
    }),
    useWeeks: useWeeks.value,
  };
});

const topTasksData = computed(() => {
  if (!filteredRows.value.length || !form.dateRange?.[0]) return null;

  const byTask = {};
  filteredRows.value.forEach((row) => {
    if (!byTask[row.id]) {
      byTask[row.id] = {key: row.id, title: row.title, url: row.url, totalPoints: 0, createdDate: row.createdDate, maxDate: row.maxDate};
    }
    const entry = byTask[row.id];
    entry.totalPoints += row.totalPoints;
    if (row.createdDate && (!entry.createdDate || row.createdDate < entry.createdDate)) entry.createdDate = row.createdDate;
    if (row.maxDate && (!entry.maxDate || row.maxDate > entry.maxDate)) entry.maxDate = row.maxDate;
  });

  const top = Object.values(byTask).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 10);

  return {
    rows: top.map((row) => {
      const taskStart = dayjs(row.createdDate ?? form.dateRange[0]);
      const taskEnd = dayjs(row.maxDate ?? row.createdDate ?? form.dateRange[1] ?? form.dateRange[0]);
      const monthsLength = Math.max(1, taskEnd.diff(taskStart, 'month', true));
      const weeksLength = Math.max(1, taskEnd.diff(taskStart, 'week', true));
      return {
        key: row.key,
        title: row.title,
        url: row.url,
        totalPoints: row.totalPoints,
        avgPerMonth: Math.round((row.totalPoints / monthsLength) * 10) / 10,
        avgPerWeek: Math.round((row.totalPoints / weeksLength) * 10) / 10,
      };
    }),
    useWeeks: useWeeks.value,
  };
});

const timelineChartData = computed(() => {
  if (!allUserTasksPerUser.value.length || !form.dateRange?.[0]) return null;

  const start = dayjs(form.dateRange[0]);
  const end = dayjs(form.dateRange[1] ?? form.dateRange[0]);
  const now = dayjs();

  const buckets = [];
  if (useWeeks.value) {
    let cur = start.startOf('week');
    const lastComplete = now.startOf('week').subtract(1, 'week');
    const endBucket = end.startOf('week').valueOf() <= lastComplete.valueOf()
      ? end.startOf('week')
      : lastComplete;
    while (cur.valueOf() <= endBucket.valueOf()) {
      buckets.push(cur.format('YYYY-MM-DD'));
      cur = cur.add(1, 'week');
    }
  } else {
    let cur = start.startOf('month');
    const lastComplete = now.startOf('month').subtract(1, 'month');
    const endBucket = end.startOf('month').valueOf() <= lastComplete.valueOf()
      ? end.startOf('month')
      : lastComplete;
    while (cur.valueOf() <= endBucket.valueOf()) {
      buckets.push(cur.format('YYYY-MM'));
      cur = cur.add(1, 'month');
    }
  }

  const getBucket = (date) => useWeeks.value
    ? dayjs(date).startOf('week').format('YYYY-MM-DD')
    : dayjs(date).format('YYYY-MM');

  const formatLabel = (bucket) => useWeeks.value
    ? dayjs(bucket).format('DD.MM')
    : dayjs(bucket).format('MM.YYYY');

  const multiUser = allUserTasksPerUser.value.length > 1;

  const datasets = allUserTasksPerUser.value.flatMap(({userId, tasks}) => {
    const userName = users.value.find((u) => u.id === userId)?.name ?? userId;
    const color = stringToPastelColor(userName);

    const pointsByBucket = Object.fromEntries(buckets.map((b) => [b, 0]));
    const countByBucket = Object.fromEntries(buckets.map((b) => [b, 0]));
    tasks.forEach((task) => {
      const dateForBucket = task.closedDate ?? task.createdDate;
      if (!dateForBucket) return;
      const key = getBucket(dateForBucket);
      if (!(key in pointsByBucket)) return;
      pointsByBucket[key] += getTaskPointsFromName(task.title);
      countByBucket[key] += 1;
    });

    return [
      {
        label: multiUser ? `${userName} — баллы` : 'Баллы',
        data: buckets.map((b) => pointsByBucket[b]),
        yAxisID: 'y',
        tension: 0.3,
        borderWidth: 1,
        borderColor: color,
        pointBackgroundColor: color,
        pointStyle: 'circle',
        fill: false,
      },
      {
        label: multiUser ? `${userName} — задачи` : 'Задачи',
        data: buckets.map((b) => countByBucket[b]),
        yAxisID: 'y1',
        tension: 0.3,
        borderWidth: 1,
        borderColor: color,
        pointBackgroundColor: color,
        pointStyle: 'rectRot',
        borderDash: [5, 5],
        fill: false,
      },
    ];
  });

  return {
    labels: buckets.map(formatLabel),
    datasets,
  };
});

async function loadUsers() {
  const groupUsers = await bitrixApi.getGroupUsers(props.groupId);
  users.value = groupUsers.map((u) => ({
    id: String(u.ID),
    name: [u.NAME, u.LAST_NAME].filter(Boolean).join(' '),
    photo: u.PERSONAL_PHOTO || null,
  }));
}

function onSaveSettings(newSettings) {
  settings.value = newSettings;
  Object.assign(form, getDefaults());
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
    const pid = String(task.parentId ?? '0');
    if (!pid || pid === '0' || !taskMap.has(pid)) return currentId;
    currentId = pid;
  }
}

async function fetchUserData(userId, userName, dateFrom, dateTo, status) {
  const userTasks = await bitrixApi.searchTasks({
    groupId: form.groupFilter === 'current' ? props.groupId : null,
    responsibleId: userId,
    createdDateFrom: dateFrom,
    createdDateTo: dateTo,
    status,
  });

  const taskMap = new Map(userTasks.map((t) => [String(t.id), t]));

  let unknownParentIds = new Set();
  taskMap.forEach((task) => {
    const pid = String(task.parentId ?? '0');
    if (pid !== '0' && !taskMap.has(pid)) unknownParentIds.add(pid);
  });

  while (unknownParentIds.size > 0) {
    const parents = await bitrixApi.searchTasks({ids: [...unknownParentIds]});
    const nextUnknown = new Set();
    parents.forEach((p) => {
      const pId = String(p.id);
      taskMap.set(pId, p);
      const ppId = String(p.parentId ?? '0');
      if (ppId !== '0' && !taskMap.has(ppId)) nextUnknown.add(ppId);
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
        maxDate: rootTask?.createdDate ?? null,
        totalPoints: 0,
        tasks: [],
      });
    }

    const entry = rootMap.get(rootId);
    entry.totalPoints += points;
    if (task.createdDate && (!entry.maxDate || task.createdDate > entry.maxDate)) {
      entry.maxDate = task.createdDate;
    }
    entry.tasks.push({
      id: task.id,
      title: task.title,
      url: getTaskUrl(props.groupId, task.id),
      createdDate: task.createdDate ?? null,
      points,
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

  try {
    const dateFrom = dayjs(form.dateRange[0]).format('YYYY-MM-DD 00:00:00');
    const dateTo = dayjs(form.dateRange[1] ?? form.dateRange[0]).format('YYYY-MM-DD 23:59:59');
    const status = form.statusFilter === 'all' ? null : form.statusFilter;

    const results = await Promise.all(
      form.selectedUserIds.map((userId) => {
        const userName = users.value.find((u) => u.id === userId)?.name ?? userId;
        return fetchUserData(userId, userName, dateFrom, dateTo, status);
      }),
    );

    allUserTasksPerUser.value = results.map((r) => ({userId: r.userId, tasks: r.tasks}));
    rows.value = orderBy(
      results.flatMap((r) => r.rows),
      ['totalPoints', 'createdDate'],
      ['desc', 'asc'],
    );

    if (form.compareWithPrev && form.dateRange[1]) {
      const durationDays = dayjs(form.dateRange[1]).diff(dayjs(form.dateRange[0]), 'day');
      const prevEndDay = dayjs(form.dateRange[0]).subtract(1, 'day');
      const prevStartDay = prevEndDay.subtract(durationDays, 'day');
      const prevResults = await Promise.all(
        form.selectedUserIds.map((userId) => {
          const userName = users.value.find((u) => u.id === userId)?.name ?? userId;
          return fetchUserData(userId, userName, prevStartDay.format('YYYY-MM-DD 00:00:00'), prevEndDay.format('YYYY-MM-DD 23:59:59'), status);
        }),
      );
      prevRows.value = prevResults.flatMap((r) => r.rows);
    }
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

const selectedRow = ref(null);
const isTaskListOpened = ref(false);

function openTaskList(row) {
  selectedRow.value = row;
  isTaskListOpened.value = true;
}

onMounted(async () => {
  const [, stored] = await Promise.all([
    loadUsers(),
    chrome.storage.local.get([settingsStorageKey]),
  ]);
  if (stored[settingsStorageKey]) {
    settings.value = stored[settingsStorageKey];
    Object.assign(form, getDefaults());
  }
  isInitialLoading.value = false;
  fetchData();
});
</script>

<template>
  <div style="min-width: 580px;">
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
      <div class="flex gap-3 mb-4 items-end flex-wrap">
        <FormField label="Период">
          <DatePicker
            v-model="form.dateRange"
            selection-mode="range"
            date-format="dd.mm.yy"
            :manual-input="false"
            size="small"
          >
            <template #footer>
              <div
                class="flex gap-1"
                style="border-top: 1px solid var(--p-datepicker-panel-border-color); padding-top: var(--spacing);"
              >
                <Button
                  v-for="preset in datePresets"
                  :key="preset.months"
                  v-tooltip.bottom="preset.tooltip"
                  :label="preset.label"
                  size="small"
                  severity="secondary"
                  variant="text"
                  class="flex-1"
                  @click="applyPreset(preset.months)"
                />
              </div>
            </template>
          </DatePicker>
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
            style="min-width: 180px;"
            size="small"
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
          />
        </FormField>

        <FormField label="Сравнить с пред. периодом">
          <ToggleSwitch v-model="form.compareWithPrev" />
        </FormField>

        <Button
          label="Загрузить"
          :loading="isLoading"
          icon="pi pi-search"
          size="small"
          @click="fetchData"
        />
      </div>

      <TaskCharts
        v-if="allUserTasksPerUser.length"
        :timeline-chart-data="timelineChartData"
        :all-user-tasks-per-user="allUserTasksPerUser"
        :users="users"
        :summary-table-data="summaryTableData"
        :top-tasks-data="topTasksData"
        :multi-user="form.selectedUserIds.length > 1"
        :copy-separator="settings.copySeparator ?? '\t'"
        :csv-separator="settings.csvSeparator ?? ','"
        :default-tab="settings.defaultTab ?? 'timeline'"
        class="mb-4"
      />

      <DataTable
        :value="filteredRows"
        :loading="isLoading"
        data-key="key"
        sort-field="totalPoints"
        :sort-order="-1"
        :default-sort-order="-1"
        paginator
        :rows="20"
        :rows-per-page-options="[10, 20, 50]"
        size="small"
      >
        <Column
          v-if="form.selectedUserIds.length > 1"
          field="userName"
          header="Исполнитель"
          sortable
        />
        <Column header="Корневая задача">
          <template #body="{ data }">
            <a
              :href="data.url"
              target="_top"
            >
              {{ data.title }}
            </a>
          </template>
        </Column>
        <Column
          field="createdDate"
          header="Дата создания"
          sortable
        >
          <template #body="{ data }">
            {{ data.createdDate ? dayjs(data.createdDate).format('DD.MM.YYYY') : '—' }}<template v-if="data.maxDate && dayjs(data.maxDate).format('DD.MM.YYYY') !== dayjs(data.createdDate).format('DD.MM.YYYY')">
              — {{ dayjs(data.maxDate).format('DD.MM.YYYY') }}
            </template>
          </template>
        </Column>
        <Column
          field="totalPoints"
          header="Баллы"
          sortable
        >
          <template #body="{ data }">
            <Button
              size="small"
              variant="text"
              severity="secondary"
              @click="openTaskList(data)"
            >
              {{ data.totalPoints }} ({{ data.tasks.length }})
            </Button>
          </template>
        </Column>

        <template #empty>
          Нет данных за выбранный период
        </template>
      </DataTable>

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

  <Dialog
    v-model:visible="isTaskListOpened"
    :header="selectedRow?.title"
    dismissable-mask
    modal
  >
    <TaskList :tasks="selectedRow?.tasks ?? []" />
  </Dialog>
</template>
