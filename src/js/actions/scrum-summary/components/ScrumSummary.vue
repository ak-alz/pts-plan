<script setup>
import dayjs from 'dayjs';
import { forEachRight, orderBy, sum } from 'lodash-es';
import { Button, Dialog, Skeleton } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { stringToPastelColor } from '../../../utils.js';
import { defaultIgnorePoints, defaultMaxSprints } from '../variables.js';
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

      return {
        ...user,
        visibleSprints: currentPeriod,
        filteredSprintsLength: filteredSprints.length,
        avg,
        median,

        deltaAvg: currentPeriod.length === prevPeriod.length ? avg - prevAvg : 0,
        deltaMedian: currentPeriod.length === prevPeriod.length ? median - prevMedian : 0,
      };
    });
});
const dateUpdated = ref(null);

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
    const comments = await bitrixApi.getTaskComments(props.groupId, settings.value.taskId);

    if (!comments.length) {
      throw new Error(`Не удалось найти комментарии для задачи ${settings.value.taskId}`);
    }

    // Паттерн отбирает из всех комментариев задачи только комментарии с итогами спринта
    const pattern = /итог[и]?[^]*?\b(\d+)[^]*?спринт[ау]?[\s\S]*?(?:[А-Яа-я]+\s[А-Яа-я]+ — \d+ балл(?:ов|а)\n?)+/gi;

    const sprintsAcc = [];
    const usersMap = {};

    forEachRight(comments, (comment) => {
      pattern.lastIndex = 0;

      const match = pattern.exec(comment.textContent);
      if (!match) return;

      const userLinks = [...comment.querySelectorAll('li a[href*="/company/personal/user/"]')];
      if (!userLinks.length) return;

      const sprintNumber = Number(match[1]);
      sprintsAcc.push(sprintNumber);

      userLinks.forEach((link) => {
        const id = link.href.match(/\/user\/(\d+)(?:\/|\?|$)/)[1];

        const m = /(\d+)\s+балл(?:ов|а|)/g.exec(link.closest('li').textContent);
        const points = m?.[1] ? Number(m[1]) : 0;

        if (!points) return;

        if (!usersMap[id]) {
          usersMap[id] = {
            id,
            name: link.textContent,
            url: link.href,
            sprints: [],
            color: stringToPastelColor(link.textContent),
          };
        }

        const sprint = {
          x: sprintNumber,
          y: points,
        };

        usersMap[id].sprints.push(sprint);
      });
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
    </div>

    <Skeleton
      v-if="isLoading"
      style="height: 100px; width: 1000px;"
      class="mb-3"
    />

    <SummaryTable
      v-else
      :users="computedUsers"
      class="mb-3"
    />

    <Skeleton
      v-if="isLoading"
      style="height: 300px; width: 1000px;"
    />

    <SummaryChart
      v-show="!isLoading"
      :users="computedUsers"
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
