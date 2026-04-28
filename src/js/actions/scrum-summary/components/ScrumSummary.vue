<script setup>
import dayjs from 'dayjs';
import { forEachRight, orderBy, sum } from 'lodash-es';
import { Button, Dialog, Skeleton, ToggleButton } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import {stringToPastelColor} from '../../../utils.js';
import { computeTrendLine, defaultIgnorePoints, defaultMaxSprints } from '../variables.js';
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
const sprints = ref([]);
const users = ref([]);
const computedUsers = computed(() => {
  const ignorePoints = typeof settings.value.ignorePoints === 'number' ? settings.value.ignorePoints : defaultIgnorePoints;
  const maxSprintsCount = settings.value.maxSprintsCount || defaultMaxSprints;

  return users.value
    .filter(({ id }) => settings.value.users?.length && settings.value.users?.includes(id))
    .map((user) => {
      const filteredSprints = user.sprints
        .filter(({y}) => y >= ignorePoints);
      const currentPeriod = filteredSprints.slice(0, maxSprintsCount);
      const prevPeriod = filteredSprints.slice(maxSprintsCount, 2 * maxSprintsCount);

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
        : trendDelta !== null ? 100 : null;

      return {
        ...user,
        visibleSprints: currentPeriod,
        filteredSprintsLength: filteredSprints.length,
        avg,
        median,

        deltaAvg: currentPeriod.length === prevPeriod.length ? avg - prevAvg : 0,
        deltaMedian: currentPeriod.length === prevPeriod.length ? median - prevMedian : 0,

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
    const urlUserPattern = /\[URL=([^\]]*\/company\/personal\/user\/(\d+)\/)]([^[]+)\[\/URL]\D*(\d+)\s+балл/g;
    // Старый формат: [USER=ID]Имя[/USER] — N балл
    const bbUserPattern = /\[USER=(\d+)]([^[]+)\[\/USER]\D*(\d+)\s+балл/g;

    const sprintsAcc = [];
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

      sprintsAcc.push(sprintNumber);

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

    sprints.value = sprintsAcc;
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

/* Настройки */
const isSettingsModalOpened = ref(false);

async function onSaveSettings() {
  isSettingsModalOpened.value = false;

  const oldTaskId = settings.value.taskId;

  await loadSettings();

  if (settings.value.taskId !== oldTaskId) {
    fetchData();
  }
}

onMounted(async () => {
  await loadSettings();

  fetchData();
});
</script>

<template>
  <div v-if="settings.taskId">
    <div class="flex gap-2 mb-3">
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
  </div>

  <SettingsForm
    v-else
    :users
    :sprints
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
      :sprints
      :initial="settings"
      :settings-storage-key
      @success="onSaveSettings"
    />
  </Dialog>
</template>

<style scoped>

</style>
