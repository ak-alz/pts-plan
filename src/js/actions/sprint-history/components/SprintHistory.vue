<script setup>
import dayjs from 'dayjs';
import { Avatar, Button, Checkbox, Dialog, MultiSelect, Select, ToggleSwitch } from 'primevue';
import { computed, onMounted, ref, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { usePersonalGroupFilter } from '../../../composables/usePersonalGroupFilter.js';
import { collectStagesFromTasks, groupStagesByGroup } from '../../../personalPlan.js';
import { showToast } from '../../../toastHost/showToast.js';
import DateRangePicker from '../../../ui/DateRangePicker.vue';
import FormField from '../../../ui/FormField.vue';
import { getTaskPointsFromName, isHotfixTask, pluralize } from '../../../utils.js';
import { getPeriodRange, ROOT_STATUS_OPTIONS } from '../variables.js';
import GroupedTasksTable from './GroupedTasksTable.vue';
import SettingsForm from './SettingsForm.vue';
import TaskTable from './TaskTable.vue';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  context: {
    type: Object,
    required: true,
  },
});

const isPersonal = computed(() => props.context.type === 'personal');
// Ссылки на задачи: на личном плане Bitrix рендерит карточки через пользователя, даже если у
// задачи есть настоящая группа, — поэтому там groupId принудительно пустой
const linkGroupId = computed(() => (isPersonal.value ? null : props.context.id));
const linkUserId = computed(() => (isPersonal.value ? props.context.id : null));
// Ключ для chrome.storage — обязательно разный неймспейс, иначе настройки личного плана
// схлопнутся с несуществующей группой с тем же числовым id, что и userId
const contextKey = computed(() => isPersonal.value ? `personal-${props.context.id}` : props.context.id);

const bitrixApi = new BitrixApi(props.sessionId);
const settingsKey = computed(() => `sprint-history-settings-${contextKey.value}`);

// В личный план попадают задачи разных групп — фильтр позволяет сузить историю до одной.
// Пусто означает «все группы»
const { groupOptions, selectedGroupId, restoreGroupFilter } = usePersonalGroupFilter(
  bitrixApi,
  `sprint-history-group-${props.context.id}`,
);

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
  const stored = await chrome.storage.local.get(settingsKey.value);
  settings.value = stored[settingsKey.value] ?? {};
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
  return tasks;
});

// Выбранные колонки в порядке канбана — для цветных кружков в поле мультиселекта
const selectedStages = computed(() => stages.value.filter((stage) => selectedStageIds.value.includes(stage.id)));

// Колонки из нескольких канбанов разводим группами PrimeVue, а не подписью в каждой опции —
// с заголовком группы над списком подпись у каждой строки была бы лишней. Одна группа — плоский
// список без заголовка
const stageGroups = computed(() => groupStagesByGroup(stages.value));
const hasSeveralStageGroups = computed(() => stageGroups.value.length > 1);
const stageSelectOptions = computed(() => (hasSeveralStageGroups.value ? stageGroups.value : stages.value));

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
  let rows = groupedRows.value;

  // Фильтр по колонке применяется к родительской задаче группы, а не к задачам спринта: стадия
  // канбана проставлена у корневой задачи, у подзадач её обычно нет вовсе. Группы, чья родительская
  // задача не найдена (parentStageId пуст), при активном фильтре скрываются — сопоставить их не с чем
  if (selectedStageIds.value.length) {
    rows = rows.filter((row) => row.parentStageId && selectedStageIds.value.includes(row.parentStageId));
  }

  if (rootStatusFilter.value !== 'all') {
    const wantClosed = rootStatusFilter.value === 'closed';
    rows = rows.filter((row) => !!row.parentClosedDate === wantClosed);
  }

  return rows;
});

async function fetchStages() {
  try {
    const { data } = await bitrixApi.getStages(props.context.id);
    stages.value = Object.values(data.result)
      .sort((a, b) => a.SORT - b.SORT)
      .map((stage) => ({ id: String(stage.ID), title: stage.TITLE, name: stage.TITLE, color: `#${stage.COLOR}` }));
  } catch (e) {
    console.warn(e);
  }
}

// На личном плане своего набора колонок нет: у каждой задачи STAGE_ID указывает на канбан её
// собственной группы. Поэтому список собирается из уже загруженных задач — и обновляется вместе
// с ними, ведь при другом периоде и группы будут другие.
// Родительские задачи учитываются наравне с задачами спринта: в режиме группировки фильтр
// применяется именно к колонке родителя, и без них половина вариантов в списке бы не появилась
async function refreshPersonalStages() {
  try {
    stages.value = await collectStagesFromTasks(bitrixApi, [
      ...allTasks.value,
      ...Object.values(parentTasksMap.value),
    ]);
  } catch (error) {
    console.warn(error);
    stages.value = [];
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

  if (isPersonal.value) await refreshPersonalStages();
}

async function fetchData() {
  if (!dateRange.value?.[0]) return;

  isLoading.value = true;
  parentTasksMap.value = {};
  groupedDataLoaded.value = false;

  try {
    const dateFrom = dayjs(dateRange.value[0]).format('YYYY-MM-DD 00:00:00');
    const dateTo = dayjs(dateRange.value[1] ?? dateRange.value[0]).format('YYYY-MM-DD 23:59:59');
    // На личном плане «мои задачи» — объединение 4 ролей, а не только ответственность,
    // поэтому в выборку попадают и чужие задачи, где пользователь наблюдатель или соисполнитель
    const searchParams = {
      status: 'closed',
      closedDateFrom: dateFrom,
      closedDateTo: dateTo,
    };
    const tasks = isPersonal.value
      ? await bitrixApi.searchMyTasks(props.context.id, { ...searchParams, groupId: selectedGroupId.value })
      : await bitrixApi.searchTasks({ ...searchParams, groupId: props.context.id });

    allTasks.value = tasks.map((task) => ({
      ...task,
      points: getTaskPointsFromName(task.title),
    }));

    // В режиме группировки колонки соберёт fetchGroupedData() — он добавляет к выборке ещё и
    // родительские задачи, а собирать дважды значит дважды сходить в batch
    if (groupByParent.value) {
      await fetchGroupedData();
    } else if (isPersonal.value) {
      await refreshPersonalStages();
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
  // На личном плане колонки известны только из самих задач, поэтому там их собирает fetchData()
  if (isPersonal.value) await restoreGroupFilter();
  else await fetchStages();
  await fetchData();
});
</script>

<template>
  <div class="min-w-[640px]">
    <div class="mb-3 flex items-center gap-2">
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
        <FormField
          v-if="isPersonal"
          label="Группа"
          tip="В личный план попадают задачи разных групп. Пусто — считаем по всем"
        >
          <Select
            v-model="selectedGroupId"
            :options="groupOptions"
            option-label="name"
            option-value="id"
            placeholder="Все группы"
            show-clear
            filter
            filter-placeholder="Поиск"
            size="small"
            class="min-w-[200px]"
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
            :options="stageSelectOptions"
            option-label="title"
            option-value="id"
            :option-group-label="hasSeveralStageGroups ? 'groupName' : undefined"
            :option-group-children="hasSeveralStageGroups ? 'stages' : undefined"
            placeholder="Все колонки"
            filter
            :filter-fields="['title', 'groupName']"
            filter-placeholder="Поиск"
            show-clear
            size="small"
            fluid
            input-class="min-w-[160px]"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <span
                  v-if="option.color"
                  class="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  :style="`background-color: ${option.color};`"
                />
                <span>{{ option.title }}</span>
              </div>
            </template>
            <template #value="{ value, placeholder }">
              <div
                v-if="value?.length"
                class="flex items-center gap-2"
              >
                <span
                  v-for="stage in selectedStages"
                  :key="stage.id"
                  v-tooltip.top="stage.name"
                  class="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  :style="`background-color: ${stage.color};`"
                />
                <span>{{ selectedStages.length }} {{ pluralize(selectedStages.length, ['колонка', 'колонки', 'колонок']) }}</span>
              </div>
              <span v-else>{{ placeholder }}</span>
            </template>
          </MultiSelect>
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
      :group-id="linkGroupId"
      :user-id="linkUserId"
      :stages="stages"
      :loading="isLoading"
    />

    <TaskTable
      v-else
      :tasks="filteredTasks"
      :group-id="linkGroupId"
      :user-id="linkUserId"
      :loading="isLoading"
    />

    <Dialog
      v-model:visible="isSettingsModalOpened"
      modal
      header="Настройки истории спринта"
    >
      <SettingsForm
        :session-id="sessionId"
        :context="context"
        :stages="stages"
        :users="users"
        :initial="settings"
        @success="onSettingsSaved"
      />
    </Dialog>
  </div>
</template>
