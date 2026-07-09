<script setup>
import dayjs from 'dayjs';
import { Avatar, Button, Checkbox, Select, ToggleSwitch } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import DateRangePicker from '../../../ui/DateRangePicker.vue';
import FormField from '../../../ui/FormField.vue';
import { getTaskPointsFromName, isHotfixTask } from '../../../utils.js';
import GroupedTasksTable from './GroupedTasksTable.vue';
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

const toast = useToast();
const bitrixApi = new BitrixApi(props.sessionId);

function getPrevWeekRange() {
  const today = dayjs();
  const dow = today.day(); // 0=Sun, 1=Mon … 6=Sat
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = today.subtract(daysSinceMonday, 'day').startOf('day');
  return [
    thisMonday.subtract(7, 'day').toDate(),
    thisMonday.subtract(1, 'day').toDate(),
  ];
}

const dateRange = ref(getPrevWeekRange());
const selectedUserId = ref(null);
const excludeHotfixes = ref(false);
const isLoading = ref(false);
const allTasks = ref([]);

const groupByParent = ref(false);
const stages = ref([]);
const parentTasksMap = ref({});
const groupedDataLoaded = ref(false);

const users = computed(() => {
  const map = {};
  allTasks.value.forEach((t) => {
    if (!map[t.responsible.id]) {
      map[t.responsible.id] = {
        id: t.responsible.id,
        name: t.responsible.name,
        photo: t.responsible.icon || null,
      };
    }
  });
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
});

const filteredTasks = computed(() => {
  let tasks = allTasks.value;
  if (excludeHotfixes.value) tasks = tasks.filter((t) => !isHotfixTask(t.title));
  if (selectedUserId.value) tasks = tasks.filter((t) => t.responsible.id === selectedUserId.value);
  return tasks;
});

const allTasksById = computed(() => {
  const map = {};
  allTasks.value.forEach((t) => {
    map[String(t.id)] = t;
  });
  return map;
});

const groupedRows = computed(() => {
  const groups = {};

  filteredTasks.value.forEach((task) => {
    const pid = String(task.parentId ?? 0);
    const key = pid !== '0' ? pid : String(task.id);

    if (!groups[key]) {
      groups[key] = { key, isOwnRoot: pid === '0', tasks: [] };
    }
    if (pid !== '0') groups[key].isOwnRoot = false;
    groups[key].tasks.push(task);
  });

  return Object.values(groups).map((group) => {
    const parentData =
      allTasksById.value[group.key] ??
      parentTasksMap.value[group.key] ??
      null;

    const responsibles = Object.values(
      group.tasks.reduce((map, t) => {
        if (!map[t.responsible.id]) map[t.responsible.id] = t.responsible;
        return map;
      }, {}),
    );

    const subtasks = group.tasks.filter((t) => String(t.parentId ?? 0) === group.key);
    const parentIsInTasks = group.tasks.some((t) => String(t.id) === group.key);
    const parentPoints = getTaskPointsFromName(parentData?.title ?? '');
    const totalTaskPoints = group.tasks.reduce((sum, t) => sum + t.points, 0) + (parentIsInTasks ? 0 : parentPoints);

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

async function fetchGroupedData() {
  const knownIds = new Set(Object.keys(allTasksById.value));
  const parentIds = [...new Set(
    allTasks.value
      .filter((t) => {
        const pid = String(t.parentId ?? 0);
        return pid !== '0' && !knownIds.has(pid);
      })
      .map((t) => String(t.parentId)),
  )];

  const [stagesResult, parentTasksList] = await Promise.all([
    stages.value.length ? Promise.resolve(null) : bitrixApi.getStages(props.groupId),
    parentIds.length ? bitrixApi.searchTasks({ ids: parentIds }) : Promise.resolve([]),
  ]);
  const fetchedParents = Object.fromEntries(parentTasksList.map((t) => [String(t.id), t]));

  if (stagesResult) {
    stages.value = Object.values(stagesResult.data.result)
      .sort((a, b) => a.SORT - b.SORT)
      .map((s) => ({ id: String(s.ID), name: s.TITLE, color: `#${s.COLOR}` }));
  }

  parentTasksMap.value = fetchedParents;
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

    allTasks.value = tasks.map((t) => ({
      ...t,
      points: getTaskPointsFromName(t.title),
    }));

    if (groupByParent.value) {
      await fetchGroupedData();
    }
  } catch (e) {
    console.warn(e);
    toast.add({
      group: 'sprint-history',
      severity: 'error',
      summary: 'Ошибка',
      detail: e.message,
      life: 5000,
    });
  } finally {
    isLoading.value = false;
  }
}

watch(groupByParent, async (val) => {
  if (val && allTasks.value.length && !isLoading.value && !groupedDataLoaded.value) {
    isLoading.value = true;
    try {
      await fetchGroupedData();
    } catch (e) {
      console.warn(e);
      toast.add({
        group: 'sprint-history',
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

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="min-w-[640px]">
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
      <div class="flex items-center gap-4 border-t border-surface-200 pt-3">
        <Select
          v-model="selectedUserId"
          :options="users"
          option-label="name"
          option-value="id"
          placeholder="Все"
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
              class="pi pi-question-circle text-surface-400"
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
      </div>
    </div>

    <GroupedTasksTable
      v-if="groupByParent"
      :rows="groupedRows"
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
  </div>
</template>
