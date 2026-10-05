<script setup>
import { orderBy } from 'lodash-es';
import { Avatar, Column, DataTable, MultiSelect, Tag } from 'primevue';
import { computed, onMounted, ref, watch } from 'vue';

import { getTaskPointsFromName, pluralize } from '../../../utils.js';

const props = defineProps({
  // Весь список приоритетов: фильтры таблицы сюда не применяются, у окна свой выбор колонок
  rows: {
    type: Array,
    required: true,
  },
  stageOptions: {
    type: Array,
    default() {
      return [];
    },
  },
  // «Участники» из настроек виджета; пусто — все исполнители
  teamUserIds: {
    type: Array,
    default() {
      return [];
    },
  },
  // Ключ для запоминания выбранных колонок (свой у каждой группы)
  stagesStorageKey: {
    type: String,
    required: true,
  },
  hideUserAvatar: {
    type: Boolean,
    default: false,
  },
});

// «Верх списка» — первая четверть задач: достаточно узко, чтобы это были действительно главные
// задачи, и достаточно широко, чтобы на 15–20 задачах спринта в неё что-то попадало
const TOP_SHARE = 0.25;

const selectedStages = ref([]);

onMounted(async () => {
  const stored = await chrome.storage.local.get(props.stagesStorageKey);
  selectedStages.value = stored[props.stagesStorageKey] ?? [];
});

watch(selectedStages, (value) => {
  chrome.storage.local.set({ [props.stagesStorageKey]: [...value] });
});

const stageRows = computed(() => (selectedStages.value.length
  ? props.rows.filter((row) => selectedStages.value.includes(row.stageName))
  : props.rows));

// Позиции считаются среди задач выбранных колонок, в том числе чужих: «верх списка» — это верх
// всего спринта, а не только задач участников
const rankedRows = computed(() => orderBy(stageRows.value.filter((row) => row.responsible), 'priority')
  .map((row, index) => ({ ...row, rank: index + 1 })));

const totalCount = computed(() => rankedRows.value.length);
const topSize = computed(() => Math.max(1, Math.ceil(totalCount.value * TOP_SHARE)));
const unassignedCount = computed(() => stageRows.value.length - rankedRows.value.length);
const teamUserIdSet = computed(() => new Set(props.teamUserIds.map(String)));

// Индекс приоритета: насколько задачи исполнителя ближе к началу списка. Каждая задача даёт
// 100 на первом месте и 0 на последнем, индекс — среднее по задачам исполнителя. 50 — как в среднем
// по списку, поэтому сравнивать людей можно напрямую, независимо от числа задач у каждого
function rankScore(rank) {
  if (totalCount.value <= 1) return 100;
  return (1 - (rank - 1) / (totalCount.value - 1)) * 100;
}

const users = computed(() => {
  const byUser = new Map();

  rankedRows.value.forEach((row) => {
    const userId = String(row.responsible.id);
    if (teamUserIdSet.value.size && !teamUserIdSet.value.has(userId)) return;
    if (!byUser.has(userId)) byUser.set(userId, { id: userId, responsible: row.responsible, tasks: [] });
    byUser.get(userId).tasks.push(row);
  });

  return [...byUser.values()].map((user) => {
    const ranks = user.tasks.map((task) => task.rank);
    return {
      ...user,
      taskCount: user.tasks.length,
      points: user.tasks.reduce((sum, task) => sum + getTaskPointsFromName(task.title), 0),
      topCount: ranks.filter((rank) => rank <= topSize.value).length,
      averageRank: Math.round(ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length),
      bestRank: Math.min(...ranks),
      index: Math.round(ranks.reduce((sum, rank) => sum + rankScore(rank), 0) / ranks.length),
    };
  });
});

function indexSeverity(index) {
  if (index >= 60) return 'success';
  if (index <= 40) return 'danger';
  return 'secondary';
}

function indexLabel(index) {
  if (index >= 60) return 'ближе к началу';
  if (index <= 40) return 'ближе к концу';
  return 'в середине';
}

// Позиция точки на полоске: доля пути от первой задачи списка до последней
function dotPosition(rank) {
  if (totalCount.value <= 1) return 0;
  return ((rank - 1) / (totalCount.value - 1)) * 100;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <MultiSelect
      v-model="selectedStages"
      :options="stageOptions"
      option-label="name"
      option-value="name"
      filter
      filter-placeholder="Поиск"
      size="small"
      placeholder="Все колонки"
      :max-selected-labels="2"
      class="w-60 self-start"
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

    <p class="m-0 text-sm text-surface-600 dark:text-surface-300">
      Считается по {{ totalCount }} {{ pluralize(totalCount, ['задаче', 'задачам', 'задачам']) }} {{ selectedStages.length ? 'выбранных колонок' : 'всего списка' }} — например, выберите колонку спринта.
      Позиция — место задачи в этом списке, «верх» — первые {{ topSize }} {{ pluralize(topSize, ['задача', 'задачи', 'задач']) }}.
      <template v-if="teamUserIds.length">
        В таблице — только «Участники» из настроек виджета, но позиции считаются среди всех задач.
      </template>
      <template v-if="unassignedCount">
        Без исполнителя или без доступа: {{ unassignedCount }} — в расчёт не вошли.
      </template>
    </p>

    <DataTable
      :value="users"
      data-key="id"
      sort-field="index"
      :sort-order="-1"
      size="small"
      striped-rows
      show-gridlines
    >
      <Column
        field="responsible.name"
        header="Исполнитель"
        sortable
      >
        <template #body="{ data }">
          <div class="flex gap-2 items-center whitespace-nowrap">
            <Avatar
              v-if="data.responsible.photo && !hideUserAvatar"
              :image="data.responsible.photo"
              shape="circle"
            />
            <span>{{ data.responsible.name }}</span>
          </div>
        </template>
      </Column>
      <Column
        field="taskCount"
        header="Задач"
        sortable
      />
      <Column
        field="points"
        header="Баллы"
        sortable
      />
      <Column
        field="topCount"
        sortable
      >
        <template #header>
          <span
            v-tooltip.top="`Сколько задач исполнителя среди первых ${topSize} в списке`"
            class="font-semibold"
          >В верху списка <i class="pi pi-question-circle" /></span>
        </template>
        <template #body="{ data }">
          {{ data.topCount }} из {{ topSize }}
        </template>
      </Column>
      <Column
        field="averageRank"
        sortable
      >
        <template #header>
          <span
            v-tooltip.top="'Средняя позиция задач исполнителя и самая верхняя из них'"
            class="font-semibold"
          >Позиция <i class="pi pi-question-circle" /></span>
        </template>
        <template #body="{ data }">
          <span class="tabular-nums whitespace-nowrap">в среднем {{ data.averageRank }}, лучшая {{ data.bestRank }}</span>
        </template>
      </Column>
      <Column
        field="index"
        sortable
      >
        <template #header>
          <span
            v-tooltip.top="'Насколько задачи исполнителя ближе к началу списка: 100 — все в самом верху, 50 — как в среднем по списку, 0 — все в самом конце. От числа задач не зависит, поэтому людей можно сравнивать напрямую'"
            class="font-semibold"
          >Индекс приоритета <i class="pi pi-question-circle" /></span>
        </template>
        <template #body="{ data }">
          <div class="flex gap-2 items-center whitespace-nowrap">
            <span class="tabular-nums font-semibold">{{ data.index }}</span>
            <Tag
              :value="indexLabel(data.index)"
              :severity="indexSeverity(data.index)"
            />
          </div>
        </template>
      </Column>
      <Column header="Где в списке">
        <template #body="{ data }">
          <div class="relative h-3 w-44 flex items-center rounded-full overflow-hidden bg-surface-100 dark:bg-surface-800">
            <div
              class="absolute h-full bg-surface-200 dark:bg-surface-700"
              :style="{ width: `${(topSize / Math.max(totalCount, 1)) * 100}%` }"
            />
            <span
              v-for="task in data.tasks"
              :key="task.taskId"
              v-tooltip.top="`№${task.priority} — ${task.title}`"
              class="absolute w-2 h-2 rounded-full bg-primary"
              :style="{ left: `calc(${dotPosition(task.rank)}% - ${dotPosition(task.rank) / 100 * 8}px)` }"
            />
          </div>
        </template>
      </Column>

      <template #empty>
        Нет данных — в выбранных колонках нет задач участников
      </template>
    </DataTable>
  </div>
</template>
