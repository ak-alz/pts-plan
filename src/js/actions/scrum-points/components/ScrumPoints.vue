<script setup>
import dayjs from 'dayjs';
import {orderBy, sumBy} from 'lodash-es';
import { Avatar, Badge, Button, Column, ColumnGroup, DataTable, Dialog, Row } from 'primevue';
import { computed, onMounted, provide, ref } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import {showToast} from '../../../toastHost/showToast.js';
import {getTaskPointsFromName, getTaskUrl, pluralize, simplifyColumnName} from '../../../utils.js';
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
const groupUsers = ref([]);
const visibleUsers = computed(() => users.value.filter(({ id }) => settings.value.users?.length && settings.value.users?.includes(id)));
const isLoading = ref(false);
const dateUpdated = ref(null);

async function fetchData() {
  isLoading.value = true;

  const stored = await chrome.storage.local.get([settingsStorageKey.value]);
  if (stored[settingsStorageKey.value]) {
    settings.value = stored[settingsStorageKey.value];
  }

  try {
    // Запускаем параллельно: метаданные колонок, задачи выбранных колонок и участники группы.
    // Колонки берём из уже загруженных настроек
    const savedColumnIds = settings.value.columns || [];

    const [stagesResponse, tasks, rawGroupUsers] = await Promise.all([
      bitrixApi.getStages(props.groupId),
      bitrixApi.getAllTasksByStages(savedColumnIds, props.groupId),
      bitrixApi.getGroupUsers(props.groupId),
    ]);

    groupUsers.value = rawGroupUsers.map((user) => ({
      id: user.ID,
      name: [user.NAME, user.LAST_NAME].filter(Boolean).join(' '),
      photo: user.PERSONAL_PHOTO || false,
      url: user.DETAIL_URL || '',
    }));

    columns.value = Object.values(stagesResponse.data.result)
      .sort((a, b) => a.SORT - b.SORT)
      .map((stage) => ({
        id: stage.ID,
        name: stage.TITLE,
        shortName: simplifyColumnName(stage.TITLE),
        color: `#${stage.COLOR}`,
      }));

    // Раскидываем задачи по исполнителям и колонкам
    const usersMap = {};

    tasks.forEach((task) => {
      const points = getTaskPointsFromName(task.title);
      const stageId = task.stageId;
      const { responsible } = task;

      if (!usersMap[responsible.id]) {
        usersMap[responsible.id] = {
          id: responsible.id,
          photo: responsible.icon || false,
          name: responsible.name,
          url: responsible.link,
          columns: columns.value.reduce((acc, column) => {
            acc[column.id] = { tasks: [], totalPoints: 0 };
            return acc;
          }, {}),
          visibleTotalPoints: 0,
          visibleTasksCount: 0,
          totalPoints: 0,
          tasksCount: 0,
        };
      }

      if (visibleColumns.value.find((column) => column.id === stageId)) {
        usersMap[responsible.id].columns[stageId].tasks.push({
          id: task.id,
          name: task.title,
          url: getTaskUrl(props.groupId, task.id),
          dateUpdated: dayjs(task.activityDate).unix(),
          formattedDateUpdated: dayjs(task.activityDate).format('DD.MM.YYYY HH:mm:ss'),
          points,
          taskControl: task.taskControl === 'Y',
          isRootTask: String(task.parentId ?? 0) === '0',
        });
        usersMap[responsible.id].columns[stageId].totalPoints += points;

        if (!settings.value.excludeFromTotal?.includes(stageId)) {
          usersMap[responsible.id].visibleTotalPoints += points;
          usersMap[responsible.id].visibleTasksCount += 1;
        }
      }

      usersMap[responsible.id].totalPoints += points;
      usersMap[responsible.id].tasksCount += 1;
    });

    // Сортируем для вывода в настройках
    users.value = orderBy(Object.values(usersMap), ['totalPoints', 'tasksCount'], 'desc');

    dateUpdated.value = `Последнее обновление: ${dayjs().format('HH:mm:ss')}`;
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
// Кнопка ниже намеренно с native title, а не v-tooltip: наведение на v-tooltip перед кликом
// взвинчивает z-index открывающегося диалога (PrimeVue ZIndexUtils даёт большой скачок при смене
// категории оверлея modal/tooltip/overlay/menu) — диалог оказывается выше слайдера задачи Bitrix
// (z-index 1400), и открытая из диалога задача уходит под него
const isCompleteTasksModalOpened = ref(false);
// Обновляем сводную таблицу только если в диалоге что-то реально изменилось (завершили/отменили) —
// не дёргаем API повторно, если окно просто открыли и закрыли
const hasCompletionChanges = ref(false);

function completeTasks(column) {
  selectedColumn.value = column;
  isCompleteTasksModalOpened.value = true;
}

function onCompleteTasksModalHide() {
  if (!hasCompletionChanges.value) return;
  hasCompletionChanges.value = false;
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

/* Кнопка "Копировать итоги" / "Опубликовать итоги" */
function buildSummaryText(column) {
  const usersData = visibleUsers.value.map((user) => ({
    id: user.id,
    name: user.name,
    totalPoints: user.columns[column.id].totalPoints,
  }));

  const ordered = orderBy(usersData, ['totalPoints', 'name'], ['desc', 'asc']);
  const totalPoints = sumBy(usersData, (item) => item.totalPoints);

  return `Итоги спринта

${formatPointsCount(totalPoints)}
[LIST]
${ordered.map((user) => `[*][USER=${user.id}]${user.name}[/USER] — ${formatPointsCount(user.totalPoints)}`).join('\n')}
[/LIST]`;
}

async function copySummary(column) {
  try {
    await window.navigator.clipboard.writeText(buildSummaryText(column));
    showToast({
      severity: 'success',
      summary: 'Успешно',
      detail: 'Итоги скопированы в буфер обмена',
      life: 5000,
    });
  } catch (e) {
    console.warn(e);
    showToast({
      severity: 'error',
      summary: 'Ошибка',
      detail: e.message,
      life: 5000,
    });
  }
}

const isPosting = ref(false);

async function postSummary(column) {
  if (!settings.value.summaryTaskId) return;
  isPosting.value = true;
  try {
    const response = await bitrixApi.addComment(settings.value.summaryTaskId, `TAGALL,\n${buildSummaryText(column)}`);
    const commentId = response.data?.result;
    const commentUrl = commentId
      ? `/workgroups/group/${props.groupId}/tasks/task/view/${settings.value.summaryTaskId}/?MID=${commentId}#com${commentId}`
      : null;
    showToast({
      severity: 'success',
      summary: 'Итоги опубликованы',
      links: commentUrl ? [{ url: commentUrl, label: 'Открыть комментарий' }] : undefined,
      life: 8000,
    });
  } catch (e) {
    console.warn(e);
    showToast({
      severity: 'error',
      summary: 'Ошибка',
      detail: e.message,
      life: 5000,
    });
  } finally {
    isPosting.value = false;
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
    striped-rows
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

    <Column
      field="id"
      header="Исполнитель"
    >
      <template #body="{data}">
        <div class="flex gap-3 items-center">
          <Avatar
            v-if="data.photo && !settings.hideUserAvatar"
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
      v-if="settings.showCompleteTasksButton?.length || settings.showCopyButton?.length || (settings.showPostButton?.length && settings.summaryTaskId)"
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
                :title="`Завершить все задачи в колонке «${column.name}»`"
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
              <Button
                v-if="settings.showPostButton?.includes(column.id) && settings.summaryTaskId"
                v-tooltip="`Опубликовать итоги для колонки «${column.name}»`"
                icon="pi pi-send"
                size="small"
                rounded
                variant="text"
                severity="secondary"
                :disabled="isLoading || isPosting"
                @click="postSummary(column)"
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
      :group-users="groupUsers"
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
    @hide="onCompleteTasksModalHide"
  >
    <CompleteTasksTable
      :users
      :column="selectedColumn"
      @change="hasCompletionChanges = true"
    />
  </Dialog>
</template>

