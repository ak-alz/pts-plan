<script setup>
import VModal from '@/vue/ui/modal/VModal.vue';
import {
  computed, inject, provide, readonly, ref, watch,
} from 'vue';
import getWeekRange from '@/functions/core/getWeekRange';
import VLoader from '@/vue/ui/loader/VLoader.vue';
import VIcon from '@/vue/ui/icon/VIcon.vue';
import getNumberEnding from '@/functions/core/getNumberEnding';
import getSettings from './getSettings';
import usersDataAdapter from './usersDataAdapter';
import ScrumPointsTable from '../scrum-points-table/ScrumPointsTable.vue';
import ScrumSettings from '../scrum-settings/ScrumSettings.vue';
import columnsDataAdapter from './columnsDataAdapter';

const api = inject('api');
const groupId = inject('groupId');

const isModalOpened = defineModel({
  type: Boolean,
  default: false,
});

const settings = ref({});
const columns = ref([]);
const visibleColumns = computed(() => columns.value
  .filter(({ id }) => settings.value.columns[id]));
const users = ref([]);
const visibleUsers = computed(() => users.value
  .filter(({ id }) => settings.value.users[id]));
const isLoading = ref(false);
const loaderText = ref('');

const sprintTitle = computed(() => {
  const offset = settings.value.sprintFirstDate ? Number(settings.value.sprintFirstDate) : 1;
  const [firstDate, lastDate] = getWeekRange(offset);
  return `Итог ${settings.value?.sprintNumber} спринта с ${firstDate} по ${lastDate}`;
});

provide('settings', readonly(settings));

const getData = () => {
  isLoading.value = true;
  loaderText.value = 'Получение данных...';

  api.getInitialData(groupId)
    .then((data) => {
      if (data.status === 'success') {
        settings.value = getSettings(data.data, groupId);

        columns.value = columnsDataAdapter(data.data.columns);
        let tasks = data.data.items;

        // Если есть включенные колонки,
        // то отправляем доп. запросы для получения всех карточек в этих колонках
        // (если их больше 20)
        const columnsWithOverCards = data.data.columns
          .filter(({ id, total }) => settings.value.columns[id]
            && total > 20);
        const promises = [];
        columnsWithOverCards.forEach(({ id, total }) => {
          for (let page = 2; page <= Math.ceil(total / 20); page += 1) {
            promises.push(
              api.getColumnItems(groupId, id, page),
            );
          }
        });

        const names = columnsWithOverCards.map(({ name, total }) => `${name} (${total})`).join(', ');
        loaderText.value = `Получение дополнительных данных для колонок: ${names}. Всего запросов: ${promises.length}`;

        Promise.all(promises)
          .then((responses) => {
            responses.forEach((response) => {
              if (response.status === 'success') {
                tasks = tasks.concat(response.data);
              }
            });

            users.value = usersDataAdapter(tasks);
            isLoading.value = false;
            loaderText.value = '';
          });
      }
    });
};

const onCopy = (columnId) => {
  const usersData = visibleUsers.value.map((user) => ({
    name: user.name,
    points: user.columns[columnId]
      ? user.columns[columnId].reduce((acc, task) => acc + task.points.value, 0)
      : 0,
  }));
  const total = usersData.reduce((acc, { points }) => acc + points, 0);

  let string = `${sprintTitle.value}\n\n`;
  string += `${total} ${getNumberEnding(total, ['балл', 'балла', 'баллов'])}\n\n`;
  string += usersData.map(({ name, points }) => `${name} — ${points}`).join('\n');

  navigator.clipboard.writeText(string);
};

// Получение данных при первом открытии модалки
watch(() => isModalOpened.value, (newValue) => {
  if (newValue && !columns.value.length) {
    getData();
  }
});
</script>

<template>
  <VModal
    v-model="isModalOpened"
    size="large"
  >
    <div class="scrum-points-modal">
      <div class="scrum-points-modal__head">
        {{ sprintTitle }}
        <ScrumSettings
          v-model="settings"
          :columns
          :users
        />
        <button
          class="scrum-points-modal__button"
          type="button"
          :disabled="isLoading"
          @click="getData"
        >
          <VIcon name="sync" />
        </button>
      </div>
      <div
        v-if="isLoading"
        class="scrum-points-modal__loader"
      >
        <VLoader />
        {{ loaderText }}
      </div>
      <ScrumPointsTable
        v-else-if="visibleColumns.length && visibleUsers.length"
        :columns="visibleColumns"
        :users="visibleUsers"
        @copy="onCopy"
      />
      <div
        v-else
        class="scrum-points-modal__notice"
      >
        Настройте таблицу: выберите необходимые колонки и пользователей.
        Если в колонке больше 20 задач, то повторно обновите данные.
        Для этого нажмите на кнопку рядом с настройками.
      </div>
    </div>
  </VModal>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
