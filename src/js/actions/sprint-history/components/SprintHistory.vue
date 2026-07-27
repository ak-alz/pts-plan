<script setup>
import dayjs from 'dayjs';
import { Avatar, Button, Checkbox, Dialog, MultiSelect, Select, ToggleSwitch } from 'primevue';
import { computed, onMounted, ref, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { showToast } from '../../../toastHost/showToast.js';
import DateRangePicker from '../../../ui/DateRangePicker.vue';
import FormField from '../../../ui/FormField.vue';
import { getTaskPointsFromName, isHotfixTask } from '../../../utils.js';
import { getPeriodRange, ROOT_STATUS_OPTIONS } from '../variables.js';
import GroupedTasksTable from './GroupedTasksTable.vue';
import SettingsForm from './SettingsForm.vue';
import TaskTable from './TaskTable.vue';

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
const SETTINGS_KEY = `sprint-history-settings-${props.groupId}`;

const settings = ref({});
const isSettingsModalOpened = ref(false);

const dateRange = ref(getPeriodRange('prevWeek'));
const selectedUserId = ref(null);
const excludeHotfixes = ref(false);
const selectedStageIds = ref([]);
const rootStatusFilter = ref('all');
const isLoading = ref(false);
const allTasks = ref([]);

const groupByParent = ref(false);
const stages = ref([]);
const parentTasksMap = ref({});
const groupedDataLoaded = ref(false);

function applyDefaults() {
  dateRange.value = getPeriodRange(settings.value.defaultPeriod ?? 'prevWeek');
  selectedUserId.value = settings.value.defaultResponsibleId ?? null;
  excludeHotfixes.value = settings.value.defaultExcludeHotfixes ?? false;
  groupByParent.value = settings.value.defaultGroupByParent ?? false;
  selectedStageIds.value = settings.value.defaultStageIds ?? [];
  rootStatusFilter.value = settings.value.defaultRootStatus ?? 'all';
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  settings.value = stored[SETTINGS_KEY] ?? {};
}

function onSettingsSaved(newSettings) {
  settings.value = newSettings;
  isSettingsModalOpened.value = false;
  applyDefaults();
  fetchData();
}

const users = computed(() => {
  const map = {};
  allTasks.value.forEach((task) => {
    if (!map[task.responsible.id]) {
      map[task.responsible.id] = {
        id: task.responsible.id,
        name: task.responsible.name,
        photo: task.responsible.icon || null,
      };
    }
  });
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
});

const filteredTasks = computed(() => {
  let tasks = allTasks.value;
  if (excludeHotfixes.value) tasks = tasks.filter((task) => !isHotfixTask(task.title));
  if (selectedUserId.value) tasks = tasks.filter((task) => task.responsible.id === selectedUserId.value);
  // Только в режиме группировки: там же и стоит сам мультиселект — иначе сохранённые в настройках
  // колонки резали бы список без всякого контрола на экране
  if (groupByParent.value && selectedStageIds.value.length) {
    tasks = tasks.filter((task) => selectedStageIds.value.includes(String(task.stageId)));
  }
  return tasks;
});

const allTasksById = computed(() => {
  const map = {};
  allTasks.value.forEach((task) => {
    map[String(task.id)] = task;
  });
  return map;
});

const groupedRows = computed(() => {
  const groups = {};

  filteredTasks.value.forEach((task) => {
    const parentId = String(task.parentId ?? 0);
    const key = parentId !== '0' ? parentId : String(task.id);

    if (!groups[key]) {
      groups[key] = { key, isOwnRoot: parentId === '0', tasks: [] };
    }
    if (parentId !== '0') groups[key].isOwnRoot = false;
    groups[key].tasks.push(task);
  });

  return Object.values(groups).map((group) => {
    const parentData =
      allTasksById.value[group.key] ??
      parentTasksMap.value[group.key] ??
      null;

    const responsibles = Object.values(
      group.tasks.reduce((map, task) => {
        if (!map[task.responsible.id]) map[task.responsible.id] = task.responsible;
        return map;
      }, {}),
    );

    const subtasks = group.tasks.filter((task) => String(task.parentId ?? 0) === group.key);
    const parentIsInTasks = group.tasks.some((task) => String(task.id) === group.key);
    const parentPoints = getTaskPointsFromName(parentData?.title ?? '');
    const totalTaskPoints = group.tasks.reduce((sum, task) => sum + task.points, 0) + (parentIsInTasks ? 0 : parentPoints);

    const parentTask = parentData ? {
      id: group.key,
      title: parentData.title ?? `Задача #${group.key}`,
      responsible: parentData.responsible ?? { id: '', name: '—', link: '#', icon: null },
      closedDate: parentData.closedDate || null,
      points: parentIsInTasks ? (allTasksById.value[group.key]?.points ?? parentPoints) : parentPoints,
    } : null;

    return {
      parentId: group.key,
      parentTitle: parentData?.title ?? `Задача #${group.key}`,
      parentClosedDate: parentData?.closedDate || null,
      parentStageId: parentData?.stageId ? String(parentData.stageId) : null,
      responsibles,
      tasks: group.tasks,
      subtasks,
      parentTask,
      totalPoints: totalTaskPoints,
      hasSubtasks: subtasks.length > 0,
      totalTasks: subtasks.length + (parentTask ? 1 : 0),
    };
  });
});

const filteredGroupedRows = computed(() => {
  if (rootStatusFilter.value === 'all') return groupedRows.value;
  const wantClosed = rootStatusFilter.value === 'closed';
  return groupedRows.value.filter((row) => !!row.parentClosedDate === wantClosed);
});

async function fetchStages() {
  try {
    const { data } = await bitrixApi.getStages(props.groupId);
    stages.value = Object.values(data.result)
      .sort((a, b) => a.SORT - b.SORT)
      .map((stage) => ({ id: String(stage.ID), name: stage.TITLE, color: `#${stage.COLOR}` }));
  } catch (e) {
    console.warn(e);
  }
}

async function fetchGroupedData() {
  const knownIds = new Set(Object.keys(allTasksById.value));
  const parentIds = [...new Set(
    allTasks.value
      .filter((task) => {
        const parentId = String(task.parentId ?? 0);
        return parentId !== '0' && !knownIds.has(parentId);
      })
      .map((task) => String(task.parentId)),
  )];

  const parentTasksList = parentIds.length ? await bitrixApi.searchTasks({ ids: parentIds }) : [];
  parentTasksMap.value = Object.fromEntries(parentTasksList.map((task) => [String(task.id), task]));
  groupedDataLoaded.value = true;
}

async function fetchData() {
  if (!dateRange.value?.[0]) return;

  isLoading.value = true;
  parentTasksMap.value = {};
  groupedDataLoaded.value = false;

  try {
    const dateFrom = dayjs(dateRange.value[0]).format('YYYY-MM-DD 00:00:00');
    const dateTo = dayjs(dateRange.value[1] ?? dateRange.value[0]).format('YYYY-MM-DD 23:59:59');
    const tasks = await bitrixApi.searchTasks({
      groupId: props.groupId,
      status: 'closed',
      closedDateFrom: dateFrom,
      closedDateTo: dateTo,
    });

    allTasks.value = tasks.map((task) => ({
      ...task,
      points: getTaskPointsFromName(task.title),
    }));

    if (groupByParent.value) {
      await fetchGroupedData();
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

watch(groupByParent, async (isEnabled) => {
  if (isEnabled && allTasks.value.length && !isLoading.value && !groupedDataLoaded.value) {
    isLoading.value = true;
    try {
      await fetchGroupedData();
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
});

onMounted(async () => {
  await loadSettings();
  applyDefaults();
  await fetchStages();
  await fetchData();
});
</script>

<template>
  <div class="min-w-[640px]">
    <div class="mb-3">
      <Button
        icon="pi pi-cog"
        size="small"
        severity="secondary"
        text
        label="Настройки"
        @click="isSettingsModalOpened = true"
      />
    </div>

    <div class="flex flex-col items-start gap-3 mb-4">
      <div class="flex items-end gap-3">
        <FormField label="Период">
          <DateRangePicker
            v-model="dateRange"
            presets="current"
          />
        </FormField>
        <Button
          label="Загрузить"
          :loading="isLoading"
          icon="pi pi-search"
          size="small"
          @click="fetchData"
        />
      </div>
      <div class="flex items-center gap-4 border-t border-surface-200 dark:border-surface-700 pt-3">
        <Select
          v-model="selectedUserId"
          :options="users"
          option-label="name"
          option-value="id"
          placeholder="Все исполнители"
          show-clear
          :disabled="!allTasks.length"
          size="small"
          fluid
          input-class="min-w-[200px]"
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
        </Select>
        <div class="flex gap-2 items-center shrink-0">
          <Checkbox
            v-model="excludeHotfixes"
            binary
            input-id="sprint-history-exclude-hotfixes"
          />
          <label
            for="sprint-history-exclude-hotfixes"
            class="text-sm cursor-pointer"
          >
            Исключить хотфиксы
            <i
              v-tooltip="'Скрывает задачи, название которых начинается с «Hotfix»'"
              class="pi pi-question-circle text-surface-400 dark:text-surface-500"
            />
          </label>
        </div>
        <div class="flex gap-2 items-center shrink-0">
          <ToggleSwitch
            v-model="groupByParent"
            input-id="group-by-parent-toggle"
            size="small"
          />
          <label
            for="group-by-parent-toggle"
            class="text-sm cursor-pointer"
          >
            Группировать по задаче
          </label>
        </div>
        <template v-if="groupByParent">
          <MultiSelect
            v-model="selectedStageIds"
            :options="stages"
            option-label="name"
            option-value="id"
            placeholder="Все колонки"
            filter
            filter-placeholder="Поиск"
            show-clear
            size="small"
            fluid
            input-class="min-w-[160px]"
          />
          <Select
            v-model="rootStatusFilter"
            :options="ROOT_STATUS_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
            fluid
            input-class="min-w-[160px]"
          />
        </template>
      </div>
    </div>

    <GroupedTasksTable
      v-if="groupByParent"
      :rows="filteredGroupedRows"
      :group-id="groupId"
      :stages="stages"
      :loading="isLoading"
    />

    <TaskTable
      v-else
      :tasks="filteredTasks"
      :group-id="groupId"
      :loading="isLoading"
    />

    <Dialog
      v-model:visible="isSettingsModalOpened"
      modal
      header="Настройки истории спринта"
    >
      <SettingsForm
        :session-id="sessionId"
        :group-id="groupId"
        :stages="stages"
        :initial="settings"
        @success="onSettingsSaved"
      />
    </Dialog>
  </div>
</template>
