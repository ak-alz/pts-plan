<script setup>
import VModal from '@/vue/ui/modal/VModal.vue';
import {
  computed, inject, provide, readonly, ref, watch,
} from 'vue';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Colors,
  Filler,
} from 'chart.js';
import { Scatter } from 'vue-chartjs';
import VLoader from '@/vue/ui/loader/VLoader.vue';
import VIcon from '@/vue/ui/icon/VIcon.vue';
import ScrumSettings from '../scrum-settings/ScrumSettings.vue';
import getSettings from './getSettings';
import ScrumSummaryTable from '../scrum-summary-table/ScrumSummaryTable.vue';

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Colors,
  Filler,
);

const isModalOpened = defineModel({
  type: Boolean,
  default: false,
});

const api = inject('api');
const groupId = inject('groupId');

const settings = ref({});

const sprints = ref([]);
const usersData = ref([]);
const isLoading = ref(false);
const chartInstance = ref(null);

provide('settings', readonly(settings));

const getData = () => {
  settings.value = getSettings(groupId);
  if (!settings.value.taskId) return;

  isLoading.value = true;

  api.getTaskComments(groupId, settings.value.taskId)
    .then((res) => {
      const parser = new DOMParser();
      const html = parser.parseFromString(res, 'text/html');

      const commentElements = [...html.querySelectorAll('.feed-com-block')];
      const pattern = /итог[и]?[^]*?\b(\d+)[^]*?спринт[ау]?[\s\S]*?(?:[А-Яа-я]+\s[А-Яа-я]+ — \d+ балл(?:ов|а)\n?)+/gi;

      const comments = []; // Комменты = спринты

      commentElements.forEach((comment) => {
        pattern.lastIndex = 0;

        const match = pattern.exec(comment.textContent);
        if (match) {
          // Находим имена и баллы
          const userLinks = [...comment.querySelectorAll('li a[href*="/company/personal/user/"]')];
          if (!userLinks.length) return;

          try {
            const sprintNumber = Number(match[1]);

            const users = userLinks.map((link) => {
              const id = link.href.match(/\/user\/(\d+)(?:\/|\?|$)/)[1];

              const points = link.closest('li').textContent;
              const m = /(\d+)\s+балл(?:ов|а|)/g.exec(points);

              return {
                id,
                name: link.textContent,
                points: m?.[1] ? Number(m[1]) : 0,
                url: link.href,
              };
            });

            comments.push({
              sprintNumber,
              comment: match[0],
              element: comment,
              users,
            });
          } catch (e) {
            console.warn(e);
          }
        }
      });

      // Получаем массив спринтов
      sprints.value = comments.map(({ sprintNumber }) => sprintNumber);

      // Далее составляем список уникальных пользователей из комментариев
      const uniqueUsers = {};
      comments.forEach((comment) => {
        comment.users.forEach((user) => {
          uniqueUsers[user.id] = {
            id: user.id,
            name: user.name,
            points: [],
            url: user.url,
          };
        });
      });

      comments.forEach((comment) => {
        Object.keys(uniqueUsers)
          .forEach((userId) => {
            const user = comment.users.find(({ id }) => id === userId);

            uniqueUsers[userId].points.push(user ? user.points : 0);
          });
      });

      if (settings.value.skipVacation) {
        const maxVacationDuration = 2;
        Object.keys(uniqueUsers)
          .forEach((userId) => {
            let vacationCounter = 0;
            uniqueUsers[userId].points.forEach((point, i) => {
              if (point === 0
                && uniqueUsers[userId].points?.[i - 1] > 0
                && vacationCounter < maxVacationDuration) {
                vacationCounter += 1;
                // uniqueUsers[userId].points[i] = uniqueUsers[userId].points[i - 1];
              } else {
                vacationCounter = 0;
              }
            });
          });
      }

      usersData.value = Object.values(uniqueUsers);
      isLoading.value = false;
      settings.value = getSettings(groupId, usersData.value);
    })
    .catch((e) => {
      console.warn(e);
      isLoading.value = false;
    });
};

// Получение данных при первом открытии модалки
watch(() => isModalOpened.value, (newValue) => {
  if (newValue && !usersData.value.length) {
    getData();
  }
});

const hasVisibleUsers = computed(() => Object.values(settings.value.users)
  .some((user) => user));

const chartData = computed(() => {
  const s = settings.value.sprintsCount >= 0
    ? sprints.value.slice(-1 * settings.value.sprintsCount)
    : [...sprints.value];

  return {
    datasets: usersData.value
      .map((user) => ({
        label: user.name,
        showLine: true,
        borderWidth: 1,
        tension: 0.1,
        data: (settings.value.sprintsCount >= 0
          ? user.points.slice(-1 * settings.value.sprintsCount)
          : [...user.points])
          .map((point, i) => ({
            x: s[i],
            y: point,
          }))
          .filter(({ y }) => !!y || y >= 8),
        cubicInterpolationMode: 'monotone',
        hidden: !settings.value.users[user.id],
      })),
  };
});

const chartOptions = computed(() => ({
  interaction: {
    intersect: false,
    mode: 'x',
  },
  animation: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      itemSort(a, b) {
        return b.raw.y - a.raw.y;
      },
      callbacks: {
        footer(tooltipItems) {
          let sum = 0;

          tooltipItems.forEach((tooltipItem) => {
            sum += tooltipItem.parsed.y;
          });

          return `Итого: ${sum}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      title: {
        text: 'Спринт',
        align: 'end',
        display: true,
      },
    },
    y: {
      grid: { display: false },
      title: {
        display: true,
        align: 'end',
        text: 'Баллы',
      },
    },
  },
}));
</script>

<template>
  <VModal
    v-model="isModalOpened"
    size="large"
  >
    <div class="scrum-summary-modal">
      <div class="scrum-summary-modal__head">
        Scrum Сводка
        <ScrumSettings
          v-model="settings"
          :users="usersData"
        />
        <button
          class="scrum-summary-modal__button"
          type="button"
          :disabled="isLoading"
          @click="getData"
        >
          <VIcon name="sync" />
        </button>
      </div>
      <div
        v-if="isLoading"
        class="scrum-summary-modal__loader"
      >
        <VLoader />
        Загрузка...
      </div>
      <div v-else-if="settings.taskId && hasVisibleUsers">
        <ScrumSummaryTable :chart-instance :users="usersData" style="margin-bottom: 20px;" />
        <Scatter ref="chartInstance" :data="chartData" :options="chartOptions" />
      </div>
      <div
        v-else
        class="scrum-summary-modal__notice"
      >
        Настройте график: задайте ID задачи, затем выберите пользователей.
      </div>
    </div>
  </VModal>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
