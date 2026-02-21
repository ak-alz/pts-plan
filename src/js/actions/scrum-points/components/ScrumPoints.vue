<script setup>
import dayjs from 'dayjs';
import {orderBy, sumBy} from 'lodash-es';
import { Avatar, Badge, Button, Column, ColumnGroup, DataTable, Dialog, Row } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, provide, ref } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import {getTaskPointsFromName, pluralize, simplifyColumnName} from '../../../utils.js';
import { defaultSortColumn } from '../variables.js';
import ColumnTable from './ColumnTable.vue';
import CompleteTasksTable from './CompleteTasksTable.vue';
import SettingsForm from './SettingsForm.vue';
import TotalTable from './TotalTable.vue';

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
provide('groupId', props.groupId);
provide('bitrixApi', bitrixApi);

const settings = ref({});
const emptySettings = computed(() => !settings.value.users?.length || !settings.value.columns?.length);
const settingsStorageKey = computed(() => `scrum-points-settings-${props.groupId}`);
const columns = ref([]);
const columnsMap = computed(() => new Map(columns.value.map((column) => [column.id, column])));
const visibleColumns = computed(() => columns.value.filter(({ id }) => settings.value.columns?.length && settings.value.columns?.includes(id)));
const users = ref([]);
const visibleUsers = computed(() => users.value.filter(({ id }) => settings.value.users?.length && settings.value.users?.includes(id)));
const progress = ref(null);
const isLoading = ref(false);
const dateUpdated = ref(null);

async function fetchData() {
  progress.value = null;
  isLoading.value = true;

  const res = await chrome.storage.local.get([settingsStorageKey.value]);
  if (res[settingsStorageKey.value]) {
    settings.value = res[settingsStorageKey.value];
  }

  try {
    const { data } = await bitrixApi.applyFilter(props.groupId);

    let tasks = data.data.items;

    columns.value = data.data.columns.map((column) => ({
      id: column.id,
      name: column.name,
      shortName: simplifyColumnName(column.name),
      color: `#${column.color}`,
      total: column.total,
    }));

    // Получаем остальные задачи из каждой колонки
    const promises = [];
    visibleColumns.value
      .filter((column) => column.total > 20)
      .forEach((column) => {
        for (let page = 2; page <= Math.ceil(column.total / 20); page += 1) {
          promises.push(
            bitrixApi.getColumnItems(props.groupId, column.id, page)
              .finally(() => {
                progress.value += Math.floor(100 / promises.length);
              }),
          );
        }
      });

    // Если промисов больше 10, то предупреждаем
    if (promises.length <= 10 || window.confirm(`[pts-plan]: Вы собираетесь сделать много запросов на сервер (${promises.length}). Возможно, выбраны неверные фильтры. Продолжить?`)) {
      progress.value = 0;
      const chunks = await Promise.all(promises);
      progress.value = 100;
      chunks.forEach((chunk) => {
        tasks = tasks.concat(chunk.data.data);
      });
    }

    // Дальше получаем всех исполнителей
    // Раскидываем задачи, группируя их по колонкам
    const usersMap = {};

    tasks
      .filter((task) => !settings.value.ignoreCompleted || !task.data.completed)
      .forEach((task) => {
        const points = getTaskPointsFromName(task.data.name);

        if (!usersMap[task.data.responsible.id]) {
          usersMap[task.data.responsible.id] = {
            id: task.data.responsible.id,
            photo: task.data.responsible.photo?.src || false, // Может не быть фото
            name: task.data.responsible.name,
            url: task.data.responsible.url,
            columns: data.data.columns.reduce((acc, column) => {
              acc[column.id] = {
                tasks: [],
                totalPoints: 0,
              };
              return acc;
            }, {}),
            visibleTotalPoints: 0, // visible - считаем только для видимых колонок
            visibleTasksCount: 0,
            totalPoints: 0,
            tasksCount: 0,
          };
        }

        if (visibleColumns.value.find((column) => column.id === task.columnId)) {
          usersMap[task.data.responsible.id].columns[task.columnId].tasks.push({
            id: task.id,
            name: task.data.name,
            url: `/workgroups/group/${props.groupId}/tasks/task/view/${task.id}/`,
            dateUpdated: task.data.date_activity_ts,
            formattedDateUpdated: dayjs.unix(task.data.date_activity_ts).format('DD.MM.YYYY HH:mm:ss'),
            points,
          });
          usersMap[task.data.responsible.id].columns[task.columnId].totalPoints += points;

          if (!settings.value.excludeFromTotal?.includes(task.columnId)) {
            usersMap[task.data.responsible.id].visibleTotalPoints += points;
            usersMap[task.data.responsible.id].visibleTasksCount += 1;
          }
        }

        usersMap[task.data.responsible.id].totalPoints += points;
        usersMap[task.data.responsible.id].tasksCount += 1;
      });

    // Сортируем для вывода в настройках
    users.value = orderBy(Object.values(usersMap), ['totalPoints', 'tasksCount'], 'desc');

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

function onSaveSettings() {
  isSettingsModalOpened.value = false;
  fetchData();
}

/* Детальная информация о колонке */
const selectedUser = ref(null);
const selectedColumn = ref(null);
const isColumnModalOpened = ref(false);

function selectColumn(user, column) {
  selectedUser.value = user;
  selectedColumn.value = column;
  isColumnModalOpened.value = true;
}

/* Сводная информация по исполнителю */
const isTotalModalOpened = ref(false);

function selectTotalColumn(user) {
  selectedUser.value = user;
  isTotalModalOpened.value = true;
}

/* Завершение задач в выбранной колонке */
const isCompleteTasksModalOpened = ref(false);

function completeTasks(column) {
  selectedColumn.value = column;
  isCompleteTasksModalOpened.value = true;
}

function onCompleteTasks() {
  isCompleteTasksModalOpened.value = false;
  fetchData();
}

/* Подсказка для колонки "Итого" */
const formattedExcludedColumns = computed(() => {
  if (!settings.value.excludeFromTotal?.length) return '';

  const excludedColumns = settings.value.excludeFromTotal
    .map((id) => {
      const column = columnsMap.value.get(id);
      if (column) {
        return `«${column.name}»`;
      }

      return null;
    })
    .filter(Boolean);

  return `Исключены колонки: ${excludedColumns.join(', ')}`;
});

function formatPointsCount(count) {
  return `${count} ${pluralize(count, ['балл', 'балла', 'баллов'])}`;
}

/* Кнопка "Копировать итоги" */
async function copySummary(column) {
  const usersData = visibleUsers.value.map((user) => ({
    id: user.id,
    name: user.name,
    totalPoints: user.columns[column.id].totalPoints,
  }));

  const ordered = orderBy(usersData, ['totalPoints', 'name'], ['desc', 'asc']);

  const totalPoints = sumBy(usersData, (item) => item.totalPoints);

  const summary = `Итог 123 спринта

${formatPointsCount(totalPoints)}
[LIST]
${ordered.map((user) => `[*][USER=${user.id}]${user.name}[/USER] — ${formatPointsCount(user.totalPoints)}`).join('\n')}
[/LIST]`;

  try {
    await window.navigator.clipboard.writeText(summary);

    toast.add({
      severity: 'success',
      summary: 'Успешно',
      detail: '[pts-plan]: Итоги скопированы в буфер обмена',
      life: 5000,
    });
  } catch (e) {
    console.warn(e);
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: `[pts-plan]: ${e.message}`,
      life: 5000,
    });
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <DataTable
    :value="visibleUsers"
    :loading="isLoading"
    data-key="id"
    :sort-field="settings.sortColumn || defaultSortColumn"
    :sort-order="-1"
    :default-sort-order="-1"
  >
    <template #header>
      <div class="flex gap-2">
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
    </template>

    <template
      v-if="typeof progress === 'number'"
      #loading
    >
      {{ progress }}%
    </template>

    <Column
      field="id"
      header="Исполнитель"
    >
      <template #body="{data}">
        <div class="flex gap-3 items-center">
          <Avatar
            v-if="data.photo"
            :image="data.photo"
            shape="circle"
          />
          <a
            target="_top"
            :href="data.url"
          >
            {{ data.name }}
          </a>
        </div>
      </template>
    </Column>
    <Column
      v-for="column in visibleColumns"
      :key="column.id"
      :field="`columns.${column.id}.totalPoints`"
      sortable
    >
      <template #header>
        <Badge :style="`background-color: ${column.color};`" />
        <b v-tooltip.top="column.name">{{ column.shortName }}</b>
      </template>
      <template #body="{data}">
        <Button
          size="small"
          variant="text"
          severity="secondary"
          :disabled="!data.columns[column.id].tasks.length"
          @click="selectColumn(data, column)"
        >
          <template v-if="!!data.columns[column.id].tasks.length">
            {{ data.columns[column.id].totalPoints }}
            ({{ data.columns[column.id].tasks.length }})
          </template>
          <template v-else>
            –
          </template>
        </Button>
      </template>
    </Column>
    <Column
      field="visibleTotalPoints"
      sortable
    >
      <template #header>
        <b>Итого</b>
        <i
          v-if="settings.excludeFromTotal?.length"
          v-tooltip.top="formattedExcludedColumns"
          class="pi pi-exclamation-circle"
        />
      </template>
      <template #body="{data}">
        <Button
          size="small"
          variant="text"
          severity="secondary"
          :disabled="!data.visibleTasksCount"
          @click="selectTotalColumn(data)"
        >
          <template v-if="!!data.visibleTasksCount">
            {{ data.visibleTotalPoints }}
            ({{ data.visibleTasksCount }})
          </template>
          <template v-else>
            –
          </template>
        </Button>
      </template>
    </Column>

    <ColumnGroup
      v-if="settings.showCompleteTasksButton?.length || settings.showCopyButton?.length"
      type="footer"
    >
      <Row>
        <Column />
        <Column
          v-for="column in visibleColumns"
          :key="column.id"
        >
          <template #footer>
            <div class="flex gap-3">
              <Button
                v-if="settings.showCompleteTasksButton?.includes(column.id)"
                v-tooltip="`Завершить все задачи в колонке «${column.name}»`"
                icon="pi pi-flag"
                size="small"
                rounded
                variant="text"
                severity="secondary"
                :disabled="isLoading"
                @click="completeTasks(column)"
              />
              <Button
                v-if="settings.showCopyButton?.includes(column.id)"
                v-tooltip="`Копировать итоги для колонки «${column.name}»`"
                icon="pi pi-clipboard"
                size="small"
                rounded
                variant="text"
                severity="secondary"
                :disabled="isLoading"
                @click="copySummary(column)"
              />
            </div>
          </template>
        </Column>
        <Column />
      </Row>
    </ColumnGroup>

    <template #empty>
      <template v-if="emptySettings">
        Настройте таблицу: выберите исполнителей и колонки
      </template>
      <template v-else>
        Нет данных
      </template>
    </template>
  </DataTable>

  <Dialog
    v-model:visible="isSettingsModalOpened"
    header="Настройки"
    dismissable-mask
    modal
  >
    <SettingsForm
      :users
      :columns
      :initial="settings"
      :settings-storage-key
      @success="onSaveSettings"
    />
  </Dialog>

  <Dialog
    v-model:visible="isColumnModalOpened"
    :header="`Задачи ${selectedUser?.name} в колонке «${selectedColumn?.name}»`"
    dismissable-mask
    modal
  >
    <ColumnTable
      :user="selectedUser"
      :column="selectedColumn"
    />
  </Dialog>

  <Dialog
    v-model:visible="isTotalModalOpened"
    :header="`Задачи ${selectedUser?.name}`"
    dismissable-mask
    modal
  >
    <TotalTable
      :user="selectedUser"
      :columns="visibleColumns"
      :excluded-columns="settings.excludeFromTotal || []"
      :formatted-excluded-columns
    />
  </Dialog>

  <Dialog
    v-model:visible="isCompleteTasksModalOpened"
    :header="`Завершение всех задач в колонке «${selectedColumn?.name}»`"
    dismissable-mask
    modal
  >
    <CompleteTasksTable
      :users
      :column="selectedColumn"
      @success="onCompleteTasks"
    />
  </Dialog>
</template>

<style scoped>

</style>
