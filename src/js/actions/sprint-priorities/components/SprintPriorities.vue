<script setup>
import dayjs from 'dayjs';
import { Avatar, Button, Column, DataTable, Dialog, InputText, MultiSelect, SplitButton } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { getTaskIdFromUrl, getTaskPointsFromName, getTaskUrl, simplifyColumnName } from '../../../utils.js';

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
import SettingsForm from './SettingsForm.vue';
import TeamPoints from './TeamPoints.vue';

// Первые 3 колонки всегда видимы, не выносятся в настройки
const LOCKED_COLUMN_KEYS = ['priority', 'title', 'stage'];

const ALL_COLUMNS = [
  { key: 'priority', label: '№' },
  { key: 'title', label: 'Задача' },
  { key: 'stage', label: 'Колонка' },
  { key: 'responsible', label: 'Исполнитель' },
  { key: 'createdBy', label: 'Постановщик' },
  { key: 'createdDate', label: 'Создана' },
  { key: 'changedDate', label: 'Изменена' },
];

// Только настраиваемые колонки передаются в SettingsForm
const CONFIGURABLE_COLUMNS = ALL_COLUMNS.filter((c) => !LOCKED_COLUMN_KEYS.includes(c.key));
const DEFAULT_HIDDEN_COLUMNS = ['changedDate', 'createdBy'];

const toast = useToast();
const bitrixApi = new BitrixApi(props.sessionId);

const settingsStorageKey = computed(() => `sprint-priorities-settings-${props.groupId}`);
const markedRowStorageKey = computed(() => `sprint-priorities-mark-${props.groupId}`);
const settings = ref(null);
const isSheetLoading = ref(false);
const isTasksLoading = ref(false);
const isTeamLoading = ref(false);
const isLoading = computed(() => isSheetLoading.value || isTasksLoading.value);
const dateUpdated = ref(null);
const isSettingsModalOpened = ref(false);

const REFRESH_STORAGE_KEY = 'sprint-priorities-last-refresh';
const lastRefreshKey = ref('all');

const sheetRows = ref([]);
const enrichedRows = ref([]);
const teamRows = ref([]);
const teamTasksRaw = ref([]);
const groupUsers = ref([]);
const groupStages = ref([]);
const firstRow = ref(0);
const rowsPerPage = ref(25);

const titleFilter = ref('');
const stageFilter = ref([]);

const selectedTeamUser = ref(null);
const selectedTeamStage = ref(null);
const isTeamUserModalOpened = ref(false);

const markedRowTaskId = ref(null);

const visibleColumnKeys = computed(() => {
  const configured = settings.value?.visibleColumns
    ?? CONFIGURABLE_COLUMNS.map((c) => c.key).filter((k) => !DEFAULT_HIDDEN_COLUMNS.includes(k));
  return [...LOCKED_COLUMN_KEYS, ...configured];
});

const stageOptions = computed(() => {
  const stagesMap = new Map();
  enrichedRows.value.forEach((row) => {
    if (row.stage?.name && !stagesMap.has(row.stage.name)) {
      stagesMap.set(row.stage.name, row.stage.color ?? null);
    }
  });
  return [...stagesMap.entries()]
    .map(([name, color]) => ({ name, color }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const filteredRows = computed(() => {
  let rows = enrichedRows.value;

  const query = titleFilter.value.trim().toLowerCase();
  if (query) {
    rows = rows.filter((row) => row.title?.toLowerCase().includes(query));
  }

  if (stageFilter.value.length) {
    rows = rows.filter((row) => stageFilter.value.includes(row.stageName));
  }

  return rows;
});

const teamSelectedStages = computed(() => {
  const stageIds = settings.value?.teamStages ?? [];
  return groupStages.value
    .filter((stage) => stageIds.includes(stage.id))
    .map((stage) => ({ ...stage, shortName: simplifyColumnName(stage.name) }));
});

const selectedUserStageTasks = computed(() => {
  if (!selectedTeamUser.value) return [];
  return teamTasksRaw.value
    .filter((task) => {
      const isUserMatch = String(task.responsible?.id) === String(selectedTeamUser.value.id);
      const isStageMatch = !selectedTeamStage.value || String(task.stageId) === String(selectedTeamStage.value.id);
      return isUserMatch && isStageMatch;
    })
    .map((task) => ({
      id: task.id,
      title: task.title,
      url: getTaskUrl(props.groupId, task.id),
      points: getTaskPointsFromName(task.title),
    }))
    .sort((a, b) => b.points - a.points);
});

watch([titleFilter, stageFilter], () => {
  firstRow.value = 0;
});

async function toggleRowMark(taskId) {
  markedRowTaskId.value = markedRowTaskId.value === taskId ? null : taskId;
  if (markedRowTaskId.value) {
    await chrome.storage.local.set({ [markedRowStorageKey.value]: markedRowTaskId.value });
  } else {
    await chrome.storage.local.remove(markedRowStorageKey.value);
  }
}

async function restoreMarkedRow() {
  const stored = await chrome.storage.local.get([markedRowStorageKey.value]);
  const savedTaskId = stored[markedRowStorageKey.value] ?? null;
  if (!savedTaskId) return;
  const taskExists = enrichedRows.value.some((row) => row.taskId === savedTaskId);
  if (taskExists) {
    markedRowTaskId.value = savedTaskId;
  } else {
    await chrome.storage.local.remove(markedRowStorageKey.value);
  }
}


async function loadSettings() {
  const stored = await chrome.storage.local.get([settingsStorageKey.value]);
  settings.value = stored[settingsStorageKey.value] ?? null;
}

async function fetchGroupMeta() {
  const [rawUsers, stagesResponse] = await Promise.all([
    bitrixApi.getGroupUsers(props.groupId),
    bitrixApi.getStages(props.groupId),
  ]);

  groupUsers.value = rawUsers.map((user) => ({
    id: user.ID,
    name: [user.NAME, user.LAST_NAME].filter(Boolean).join(' '),
    photo: user.PERSONAL_PHOTO || null,
  }));

  groupStages.value = Object.values(stagesResponse.data.result)
    .sort((a, b) => a.SORT - b.SORT)
    .map((stage) => ({
      id: stage.ID,
      name: stage.TITLE,
      color: stage.COLOR ? `#${stage.COLOR}` : null,
    }));
}

function detectTaskColumnIndex(dataRows) {
  const sampleRows = dataRows.slice(0, Math.min(10, dataRows.length));
  if (!sampleRows.length) return 0;

  const columnCount = Math.max(...sampleRows.map((row) => row.c?.length ?? 0), 0);
  let bestColumnIndex = 0;
  let bestScore = 0;

  for (let colIndex = 0; colIndex < columnCount; colIndex++) {
    let score = 0;
    sampleRows.forEach((row) => {
      const cell = row?.c?.[colIndex];
      const cellValue = cell?.v ?? cell?.f ?? '';
      if (cellValue && getTaskIdFromUrl(String(cellValue))) score++;
    });
    if (score > bestScore) {
      bestScore = score;
      bestColumnIndex = colIndex;
    }
  }

  return bestColumnIndex;
}

async function parseSheetRows() {
  const sheetUrl = settings.value?.sheetUrl;
  if (!sheetUrl) return [];

  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = sheetUrl.match(/[?&#]gid=(\d+)/);
  if (!idMatch) throw new Error('Не удалось извлечь ID таблицы из ссылки');

  const spreadsheetId = idMatch[1];
  const gid = gidMatch ? gidMatch[1] : '0';

  const fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`Ошибка загрузки таблицы: ${response.status}`);

  const text = await response.text();
  const jsonText = text.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '');
  const data = JSON.parse(jsonText);

  const rows = data?.table?.rows ?? [];
  const hasHeaders = settings.value?.hasHeaders ?? true;
  const dataRows = hasHeaders ? rows.slice(1) : rows;

  const autoDetect = settings.value?.autoDetectColumn ?? true;
  const taskColumnIndex = autoDetect
    ? detectTaskColumnIndex(dataRows)
    : (settings.value?.taskColumnIndex ?? 1) - 1;

  const result = [];
  dataRows.forEach((row, rowIndex) => {
    const cell = row?.c?.[taskColumnIndex];
    const cellValue = cell?.v ?? cell?.f ?? '';
    if (!cellValue) return;

    const parsed = getTaskIdFromUrl(String(cellValue));
    if (!parsed?.taskId) return;

    result.push({ priority: rowIndex + 1, taskId: parsed.taskId });
  });

  return result;
}

async function fetchTasksData() {
  const taskIds = sheetRows.value.map((row) => row.taskId);
  if (!taskIds.length) {
    enrichedRows.value = [];
    return;
  }

  // Запрашиваем только поля для видимых колонок
  const visibleKeys = visibleColumnKeys.value;
  const selectFields = ['ID', 'TITLE', 'GROUP_ID', 'STAGE_ID'];
  if (visibleKeys.includes('responsible')) selectFields.push('RESPONSIBLE_ID');
  if (visibleKeys.includes('createdBy')) selectFields.push('CREATED_BY');
  if (visibleKeys.includes('createdDate')) selectFields.push('CREATED_DATE');
  if (visibleKeys.includes('changedDate')) selectFields.push('CHANGED_DATE');

  isTasksLoading.value = true;
  try {
    const tasksMap = await bitrixApi.getTasksByIdsBatch(taskIds, selectFields);

    const groupIds = [...new Set(Object.values(tasksMap).map((task) => task.groupId).filter(Boolean))];
    const userIds = [
      ...new Set([
        ...(visibleKeys.includes('responsible') ? Object.values(tasksMap).map((t) => t.responsibleId) : []),
        ...(visibleKeys.includes('createdBy') ? Object.values(tasksMap).map((t) => t.createdBy) : []),
      ].filter(Boolean)),
    ];

    const [stagesData, , usersData] = await Promise.all([
      groupIds.length ? bitrixApi.getStagesBatch(groupIds) : Promise.resolve({}),
      groupIds.length ? bitrixApi.getGroupsByIdsBatch(groupIds) : Promise.resolve({}),
      userIds.length ? bitrixApi.getImUsersBatch(userIds) : Promise.resolve({}),
    ]);

    enrichedRows.value = sheetRows.value.map(({ priority, taskId }) => {
      const task = tasksMap[taskId];
      if (!task) {
        return { priority, taskId, title: null, taskUrl: null, stage: null, stageName: null, responsible: null, createdBy: null, createdDate: null, changedDate: null };
      }

      const stage = stagesData[task.stageId];
      const responsible = visibleKeys.includes('responsible') ? usersData[String(task.responsibleId)] : null;
      const creator = visibleKeys.includes('createdBy') ? usersData[String(task.createdBy)] : null;

      return {
        priority,
        taskId,
        taskUrl: getTaskUrl(task.groupId, taskId),
        title: task.title,
        stage: stage ? { name: stage.TITLE, color: stage.COLOR ? `#${stage.COLOR}` : null } : null,
        stageName: stage?.TITLE ?? null,
        responsible: responsible ? { name: responsible.name, url: `/company/personal/user/${responsible.id}/`, photo: responsible.avatar || null } : null,
        createdBy: creator ? { name: creator.name, url: `/company/personal/user/${creator.id}/` } : null,
        createdDate: task.createdDate,
        formattedCreatedDate: task.createdDate ? dayjs(task.createdDate).format('DD.MM.YYYY') : null,
        changedDate: task.changedDate,
        formattedChangedDate: task.changedDate ? dayjs(task.changedDate).format('DD.MM.YYYY') : null,
      };
    });

    await restoreMarkedRow();
    dateUpdated.value = `Обновлено: ${dayjs().format('HH:mm:ss')}`;
  } catch (error) {
    console.warn(error);
    toast.add({
      group: 'sprint-priorities',
      severity: 'error',
      summary: 'Ошибка',
      detail: `[pts-plan]: ${error.message}`,
      life: 5000,
    });
  } finally {
    isTasksLoading.value = false;
  }
}

async function fetchTeamPoints() {
  if (!settings.value?.showTeamPoints) return;

  const stageIds = settings.value?.teamStages ?? [];
  if (!stageIds.length) return;

  isTeamLoading.value = true;
  try {
    const PAGE_SIZE = 50;
    const firstPageRequests = stageIds.map((stageId, index) => ({
      key: `ts_${index}`,
      stageId,
      start: 0,
    }));

    const firstResponses = await bitrixApi.getTasksBatch(firstPageRequests, props.groupId);

    let tasks = [];
    const remainingRequests = [];

    firstResponses.forEach((response) => {
      const { result, result_total } = response.data.result;
      Object.entries(result).forEach(([key, stageResult]) => {
        tasks = tasks.concat(stageResult.tasks ?? []);
        const total = result_total?.[key] ?? 0;
        if (total > PAGE_SIZE) {
          const stageIndex = parseInt(key.slice('ts_'.length));
          const stageId = stageIds[stageIndex];
          const pageCount = Math.ceil(total / PAGE_SIZE);
          for (let page = 1; page < pageCount; page++) {
            remainingRequests.push({ key: `ts_${stageIndex}_p${page}`, stageId, start: page * PAGE_SIZE });
          }
        }
      });
    });

    if (remainingRequests.length) {
      const remainingResponses = await bitrixApi.getTasksBatch(remainingRequests, props.groupId);
      remainingResponses.forEach((response) => {
        Object.values(response.data.result.result).forEach((stageResult) => {
          tasks = tasks.concat(stageResult.tasks ?? []);
        });
      });
    }

    const selectedUserIds = new Set(settings.value?.teamUsers ?? []);
    if (selectedUserIds.size) {
      tasks = tasks.filter((task) => selectedUserIds.has(String(task.responsible?.id)));
    }

    teamTasksRaw.value = tasks;

    const usersMap = {};
    tasks.forEach((task) => {
      const points = getTaskPointsFromName(task.title);
      const { responsible } = task;
      if (!responsible?.id) return;

      if (!usersMap[responsible.id]) {
        usersMap[responsible.id] = {
          id: responsible.id,
          name: responsible.name,
          url: responsible.link,
          photo: responsible.icon || null,
          stages: Object.fromEntries(stageIds.map((id) => [String(id), { points: 0, taskCount: 0 }])),
          totalPoints: 0,
          totalTaskCount: 0,
        };
      }

      const stageKey = String(task.stageId);
      if (stageKey in usersMap[responsible.id].stages) {
        usersMap[responsible.id].stages[stageKey].points += points;
        usersMap[responsible.id].stages[stageKey].taskCount += 1;
      }
      usersMap[responsible.id].totalPoints += points;
      usersMap[responsible.id].totalTaskCount += 1;
    });

    teamRows.value = Object.values(usersMap).sort((a, b) => b.totalPoints - a.totalPoints);
  } catch (error) {
    console.warn(error);
    toast.add({
      group: 'sprint-priorities',
      severity: 'error',
      summary: 'Ошибка загрузки баллов',
      detail: `[pts-plan]: ${error.message}`,
      life: 5000,
    });
  } finally {
    isTeamLoading.value = false;
  }
}

async function fetchSheetRows() {
  if (!settings.value?.sheetUrl) return;
  isSheetLoading.value = true;
  try {
    sheetRows.value = await parseSheetRows();
    firstRow.value = 0;
    await fetchTasksData();
  } catch (error) {
    console.warn(error);
    toast.add({
      group: 'sprint-priorities',
      severity: 'error',
      summary: 'Ошибка загрузки таблицы',
      detail: `[pts-plan]: ${error.message}`,
      life: 5000,
    });
  } finally {
    isSheetLoading.value = false;
  }
}

async function fetchAll() {
  sheetRows.value = [];
  enrichedRows.value = [];
  teamRows.value = [];
  teamTasksRaw.value = [];
  firstRow.value = 0;
  await Promise.all([fetchGroupMeta(), fetchSheetRows(), fetchTeamPoints()]);
}

function onPageChange(event) {
  firstRow.value = event.first;
  rowsPerPage.value = event.rows;
}

function onTeamCellClick({ user, stage }) {
  selectedTeamUser.value = user;
  selectedTeamStage.value = stage;
  isTeamUserModalOpened.value = true;
}

async function onSaveSettings() {
  isSettingsModalOpened.value = false;
  await loadSettings();
  stageFilter.value = settings.value?.defaultStageFilter ?? [];
  await Promise.all([fetchSheetRows(), fetchTeamPoints()]);
}

async function fetchTasksAndTeam() {
  await Promise.all([fetchTasksData(), fetchTeamPoints()]);
}

const refreshActions = [
  { key: 'all', label: 'Обновить всё', icon: 'pi pi-sync', command: fetchAll },
  { key: 'sheet', label: 'Обновить Google Таблицу', icon: 'pi pi-table', command: fetchSheetRows },
  { key: 'tasks', label: 'Обновить данные задач', icon: 'pi pi-list', command: fetchTasksData },
  { key: 'team', label: 'Обновить баллы команды', icon: 'pi pi-chart-bar', command: fetchTeamPoints },
  { key: 'tasksTeam', label: 'Обновить задачи и баллы команды', icon: 'pi pi-refresh', command: fetchTasksAndTeam },
];

const activeRefreshAction = computed(
  () => refreshActions.find((action) => action.key === lastRefreshKey.value) ?? refreshActions[0],
);

const refreshMenuItems = refreshActions.map((action) => ({
  label: action.label,
  icon: action.icon,
  command: () => selectRefreshAction(action),
}));

function selectRefreshAction(action) {
  lastRefreshKey.value = action.key;
  chrome.storage.local.set({ [REFRESH_STORAGE_KEY]: action.key });
  action.command();
}

onMounted(async () => {
  await loadSettings();
  const storedRefresh = await chrome.storage.local.get([REFRESH_STORAGE_KEY]);
  lastRefreshKey.value = storedRefresh[REFRESH_STORAGE_KEY] ?? 'all';
  stageFilter.value = settings.value?.defaultStageFilter ?? [];
  if (settings.value?.sheetUrl) {
    await Promise.all([fetchGroupMeta(), fetchSheetRows(), fetchTeamPoints()]);
  } else {
    await fetchGroupMeta();
  }
});
</script>

<template>
  <div
    v-if="settings?.sheetUrl"
    class="min-w-[1100px]"
  >
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
      <SplitButton
        v-tooltip="dateUpdated"
        :label="activeRefreshAction.label"
        :icon="activeRefreshAction.icon"
        :model="refreshMenuItems"
        :loading="isLoading"
        :disabled="isLoading"
        size="small"
        severity="secondary"
        outlined
        @click="activeRefreshAction.command()"
      />
    </div>

    <TeamPoints
      v-if="settings.showTeamPoints"
      :rows="teamRows"
      :selected-stages="teamSelectedStages"
      :loading="isTeamLoading"
      class="mb-4"
      @cell-click="onTeamCellClick"
    />

    <div class="flex gap-2 mb-2 items-center">
      <InputText
        v-model="titleFilter"
        size="small"
        placeholder="Поиск по названию"
        class="w-60"
      />
      <MultiSelect
        v-model="stageFilter"
        :options="stageOptions"
        option-label="name"
        option-value="name"
        filter
        filter-placeholder="Поиск"
        size="small"
        placeholder="Все колонки"
        :max-selected-labels="1"
        class="w-44"
      >
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <span
              v-if="option.color"
              class="inline-block w-2 h-2 rounded-full flex-shrink-0"
              :style="`background-color: ${option.color}`"
            />
            <span>{{ option.name }}</span>
          </div>
        </template>
      </MultiSelect>
    </div>

    <DataTable
      v-model:first="firstRow"
      :value="filteredRows"
      :loading="isLoading"
      data-key="taskId"
      size="small"
      removable-sort
      sort-field="priority"
      :sort-order="1"
      :default-sort-order="1"
      paginator
      :rows="rowsPerPage"
      :rows-per-page-options="[10, 25, 50, 100]"
      @page="onPageChange"
    >
      <template #empty>
        <span v-if="isSheetLoading">Загрузка таблицы…</span>
        <span v-else>Нет данных</span>
      </template>

      <Column
        v-if="settings?.showRowMarker !== false"
        style="width: 32px; padding-inline: 4px;"
      >
        <template #body="{ data }">
          <Button
            v-tooltip="'Отметить текущую позицию в списке'"
            :icon="data.taskId === markedRowTaskId ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
            :severity="data.taskId === markedRowTaskId ? 'warn' : 'secondary'"
            size="small"
            variant="text"
            @click="toggleRowMark(data.taskId)"
          />
        </template>
      </Column>

      <Column
        field="priority"
        header="№"
        sortable
        style="width: 60px;"
      />

      <Column
        field="title"
        header="Задача"
        sortable
      >
        <template #body="{ data }">
          <a
            v-if="data.taskUrl"
            class="pts-blur"
            :href="data.taskUrl"
            target="_top"
          >{{ data.title }}</a>
          <span v-else>—</span>
        </template>
      </Column>

      <Column
        field="stageName"
        header="Колонка"
        sortable
        style="white-space: nowrap;"
      >
        <template #body="{ data }">
          <div
            v-if="data.stage"
            class="flex items-center gap-2"
          >
            <span
              v-if="data.stage.color"
              class="inline-block w-2 h-2 rounded-full flex-shrink-0"
              :style="`background-color: ${data.stage.color}`"
            />
            <span>{{ data.stage.name }}</span>
          </div>
          <span v-else>—</span>
        </template>
      </Column>

      <Column
        v-if="visibleColumnKeys.includes('responsible')"
        field="responsible.name"
        header="Исполнитель"
        sortable
        style="white-space: nowrap;"
      >
        <template #body="{ data }">
          <div
            v-if="data.responsible"
            class="flex gap-2 items-center"
          >
            <Avatar
              v-if="data.responsible.photo"
              :image="data.responsible.photo"
              shape="circle"
            />
            <a
              :href="data.responsible.url"
              target="_top"
            >{{ data.responsible.name }}</a>
          </div>
          <span v-else>—</span>
        </template>
      </Column>

      <Column
        v-if="visibleColumnKeys.includes('createdBy')"
        field="createdBy.name"
        header="Постановщик"
        sortable
        style="white-space: nowrap;"
      >
        <template #body="{ data }">
          <a
            v-if="data.createdBy"
            :href="data.createdBy.url"
            target="_top"
          >{{ data.createdBy.name }}</a>
          <span v-else>—</span>
        </template>
      </Column>

      <Column
        v-if="visibleColumnKeys.includes('createdDate')"
        field="formattedCreatedDate"
        sort-field="createdDate"
        header="Создана"
        sortable
        style="white-space: nowrap;"
      />

      <Column
        v-if="visibleColumnKeys.includes('changedDate')"
        field="formattedChangedDate"
        sort-field="changedDate"
        header="Изменена"
        sortable
        style="white-space: nowrap;"
      />
    </DataTable>

    <Dialog
      v-model:visible="isSettingsModalOpened"
      header="Настройки"
      dismissable-mask
      modal
    >
      <SettingsForm
        :initial="settings"
        :settings-storage-key
        :all-columns="CONFIGURABLE_COLUMNS"
        :default-hidden-columns="DEFAULT_HIDDEN_COLUMNS"
        :group-users="groupUsers"
        :group-stages="groupStages"
        @success="onSaveSettings"
      />
    </Dialog>

    <Dialog
      v-model:visible="isTeamUserModalOpened"
      :header="selectedTeamUser ? (selectedTeamStage ? `${selectedTeamUser.name} — ${selectedTeamStage.name}` : `Задачи — ${selectedTeamUser.name}`) : ''"
      dismissable-mask
      modal
    >
      <DataTable
        :value="selectedUserStageTasks"
        data-key="id"
        size="small"
        sort-field="points"
        :sort-order="-1"
        style="min-width: 400px;"
      >
        <Column
          field="title"
          header="Задача"
          sortable
        >
          <template #body="{ data }">
            <a
              class="pts-blur"
              :href="data.url"
              target="_top"
            >{{ data.title }}</a>
          </template>
        </Column>
        <Column
          field="points"
          header="Баллы"
          sortable
          style="width: 80px;"
        />
        <template #empty>
          Нет задач
        </template>
      </DataTable>
    </Dialog>
  </div>

  <SettingsForm
    v-else
    :initial="settings ?? {}"
    :settings-storage-key
    :all-columns="CONFIGURABLE_COLUMNS"
    :default-hidden-columns="DEFAULT_HIDDEN_COLUMNS"
    :group-users="groupUsers"
    :group-stages="groupStages"
    @success="onSaveSettings"
  />
</template>
