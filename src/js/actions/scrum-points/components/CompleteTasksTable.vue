<script setup>
import { Button, Checkbox, Column, DataTable } from 'primevue';
import { computed, inject, onMounted, ref, watch } from 'vue';

import {showToast} from '../../../toastHost/showToast.js';
import { pluralize } from '../../../utils.js';

const props = defineProps({
  users: {
    type: Array,
    default() {
      return [];
    },
  },
  column: {
    type: Object,
    required: true,
  },
});
const emit = defineEmits(['change']);
const SLOW_CLOSE_TASK_COUNT_THRESHOLD = 5;
const SECONDS_PER_TASK = 1;

const bitrixApi = inject('bitrixApi');

const tasks = computed(() => {
  let columnTasks = [];

  props.users.forEach((user) => {
    columnTasks = columnTasks.concat(user.columns[props.column.id].tasks.map((task) => ({
      ...task,
      user: {
        id: user.id,
        name: user.name,
      },
    })));
  });

  return columnTasks;
});

const isLoading = ref(false);
const isUndoing = ref(false);
// Задачи, завершённые за это открытие окна, — пока их не закрыли, можно выборочно вернуть обратно.
// Отдельная таблица ниже, а не общая с чекбоксами: иначе чекбокс завершённой задачи путают
// с чекбоксом «завершить», хотя она уже завершена
const completedTasks = ref([]);
const completedTaskIds = computed(() => new Set(completedTasks.value.map((task) => task.id)));
const pendingTasks = computed(() => tasks.value.filter((task) => !completedTaskIds.value.has(task.id)));

// По умолчанию выбраны все задачи колонки. Список приходит из props, поэтому его нужно отслеживать:
// исчезнувшие задачи убираем из выбора, иначе «Завершить выбранные» отправило бы ID, которых уже
// нет в таблице
const selectedPendingTasks = ref([...pendingTasks.value]);
const selectedCompletedTasks = ref([]);

watch(pendingTasks, (currentPendingTasks) => {
  const availableIds = new Set(currentPendingTasks.map((task) => task.id));
  selectedPendingTasks.value = selectedPendingTasks.value.filter((task) => availableIds.has(task.id));
});

const APPROVE_CONTROLLED_TASKS_STORAGE_KEY = 'scrum-points-approve-controlled-tasks';
const approveControlledTasks = ref(false);

onMounted(async () => {
  const stored = await chrome.storage.local.get([APPROVE_CONTROLLED_TASKS_STORAGE_KEY]);
  if (stored[APPROVE_CONTROLLED_TASKS_STORAGE_KEY] !== undefined) {
    approveControlledTasks.value = stored[APPROVE_CONTROLLED_TASKS_STORAGE_KEY];
  }
});

watch(approveControlledTasks, (value) => {
  chrome.storage.local.set({ [APPROVE_CONTROLLED_TASKS_STORAGE_KEY]: value });
});

async function completeSelectedTasks() {
  isLoading.value = true;

  if (selectedPendingTasks.value.length > SLOW_CLOSE_TASK_COUNT_THRESHOLD) {
    const estimatedMinutes = Math.ceil(selectedPendingTasks.value.length * SECONDS_PER_TASK / 60);
    showToast({
      severity: 'info',
      summary: 'Задач много',
      detail: `Закрытие может занять до ${estimatedMinutes} ${pluralize(estimatedMinutes, ['минуты', 'минут', 'минут'])} — дождитесь завершения, не закрывайте окно.`,
      life: 8000,
    });
  }

  const completingTasks = selectedPendingTasks.value;

  try {
    const taskIds = completingTasks.map((task) => task.id);

    // Bitrix отказывает по отдельным задачам (нет прав, обязателен результат), не роняя весь запрос:
    // завершёнными считаем только те, по которым пришло подтверждение
    const { doneIds, failedIds: failedCompleteIds } = await bitrixApi.completeTasksBatch(taskIds);
    const doneTasks = completingTasks.filter((task) => doneIds.includes(task.id));

    let failedApproveCount = 0;

    if (approveControlledTasks.value) {
      const controlledTaskIds = doneTasks.filter((task) => task.taskControl).map((task) => task.id);
      if (controlledTaskIds.length) {
        const { failedIds } = await bitrixApi.approveTasksBatch(controlledTaskIds);
        failedApproveCount = failedIds.length;
      }
    }

    const warnings = [];
    if (failedCompleteIds.length) {
      warnings.push(`Не удалось завершить ${failedCompleteIds.length} из ${taskIds.length}. Обычно причина — нет прав или у задачи обязателен результат. Они остались в списке.`);
    }
    if (failedApproveCount) {
      warnings.push(`Не удалось подтвердить выполнение для ${failedApproveCount} из завершённых — обычно это значит, что вы не постановщик и не наблюдатель.`);
    }

    showToast({
      severity: warnings.length ? 'warn' : 'success',
      summary: doneTasks.length ? 'Сохранено' : 'Задачи не завершены',
      detail: warnings.length ? warnings.join(' ') : 'Задачи успешно завершены.',
      life: warnings.length ? 8000 : 5000,
    });

    completedTasks.value = [...completedTasks.value, ...doneTasks];
    selectedCompletedTasks.value = [...selectedCompletedTasks.value, ...doneTasks];
    selectedPendingTasks.value = completingTasks.filter((task) => !doneIds.includes(task.id));
    if (doneTasks.length) emit('change');
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

// Возврат выбранных завершённых задач в работу (tasks.task.renew) — доступен, пока не закрыли окно.
// Bitrix переводит их в «Ждёт выполнения», а не в тот статус, что был до завершения: колонка канбана
// (STAGE_ID) сохраняется, а собственный статус задачи — нет. Approve, если он был вызван, не
// откатывается — approve лишь подтверждает выполнение поверх уже завершённой задачи
async function undoSelectedTasks() {
  if (!selectedCompletedTasks.value.length) return;

  isUndoing.value = true;
  const undoingTasks = selectedCompletedTasks.value;

  try {
    const taskIds = undoingTasks.map((task) => task.id);

    const { doneIds, failedIds } = await bitrixApi.renewTasksBatch(taskIds);
    const renewedTasks = undoingTasks.filter((task) => doneIds.includes(task.id));

    showToast({
      severity: failedIds.length ? 'warn' : 'success',
      summary: renewedTasks.length ? 'Отменено' : 'Задачи не возвращены',
      detail: failedIds.length
        ? `Не удалось вернуть в работу ${failedIds.length} из ${taskIds.length} — скорее всего, на это нет прав. Они остались завершёнными.`
        : 'Задачи вернулись в свою колонку канбана со статусом «Ждёт выполнения».',
      life: failedIds.length ? 8000 : 5000,
    });

    completedTasks.value = completedTasks.value.filter((task) => !doneIds.includes(task.id));
    selectedCompletedTasks.value = undoingTasks.filter((task) => !doneIds.includes(task.id));
    selectedPendingTasks.value = [...selectedPendingTasks.value, ...renewedTasks];
    if (renewedTasks.length) emit('change');
  } catch (e) {
    console.warn(e);
    showToast({
      severity: 'error',
      summary: 'Ошибка',
      detail: e.message,
      life: 5000,
    });
  } finally {
    isUndoing.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <DataTable
      v-model:selection="selectedPendingTasks"
      :value="pendingTasks"
      data-key="id"
      size="small"
      sort-field="dateUpdated"
      :sort-order="-1"
      :default-sort-order="-1"
      paginator
      :rows="15"
      :rows-per-page-options="[15, 30, 50, 100]"
      :always-show-paginator="false"
      :loading="isLoading"
      striped-rows
      show-gridlines
    >
      <template #header>
        <div class="flex items-center gap-3">
          <Button
            :loading="isLoading"
            icon="pi pi-flag"
            :label="`Завершить выбранные задачи (${selectedPendingTasks.length})`"
            size="small"
            :disabled="!selectedPendingTasks.length"
            @click="completeSelectedTasks"
          />
          <label class="flex items-center gap-2 cursor-pointer">
            <Checkbox
              v-model="approveControlledTasks"
              binary
            />
            <span
              v-tooltip.top="'Для задач с включённой галкой «Принять работу» после завершения дополнительно вызывать подтверждение выполнения — иначе они останутся в статусе «Ждёт контроля». Подтвердить может только постановщик или наблюдатель задачи: для остальных задача завершится, но не подтвердится.'"
              class="text-sm"
            >
              Принимать работу по задачам с контролем
            </span>
          </label>
        </div>
      </template>

      <Column selection-mode="multiple" />
      <Column
        field="name"
        header="Задача"
      >
        <template #body="{data}">
          <i
            v-if="data.isRootTask"
            v-tooltip.top="'Корневая задача'"
            class="pi pi-sitemap text-surface-400 dark:text-surface-500 mr-1"
          />
          <i
            v-if="data.taskControl"
            v-tooltip.top="'Требует подтверждения выполнения («Принять работу»)'"
            class="pi pi-verified text-surface-400 dark:text-surface-500 mr-1"
          />
          <a
            class="pts-blur"
            target="_top"
            :href="data.url"
          >{{ data.name }}</a>
        </template>
      </Column>
      <Column
        field="user.name"
        header="Исполнитель"
        sortable
      />
      <Column
        field="formattedDateUpdated"
        sort-field="dateUpdated"
        header="Обновление"
        sortable
      />

      <template #empty>
        Нет данных
      </template>
    </DataTable>

    <DataTable
      v-if="completedTasks.length"
      v-model:selection="selectedCompletedTasks"
      :value="completedTasks"
      data-key="id"
      size="small"
      paginator
      :rows="15"
      :rows-per-page-options="[15, 30, 50, 100]"
      :always-show-paginator="false"
      striped-rows
      show-gridlines
    >
      <template #header>
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-surface-700 dark:text-surface-0">Завершённые в этом окне</span>
          <Button
            :loading="isUndoing"
            icon="pi pi-undo"
            severity="secondary"
            :label="`Отменить выбранные (${selectedCompletedTasks.length})`"
            size="small"
            :disabled="!selectedCompletedTasks.length"
            @click="undoSelectedTasks"
          />
        </div>
      </template>

      <Column selection-mode="multiple" />
      <Column
        field="name"
        header="Задача"
      >
        <template #body="{data}">
          <a
            class="pts-blur"
            target="_top"
            :href="data.url"
          >{{ data.name }}</a>
        </template>
      </Column>
      <Column
        field="user.name"
        header="Исполнитель"
        sortable
      />
    </DataTable>
  </div>
</template>

