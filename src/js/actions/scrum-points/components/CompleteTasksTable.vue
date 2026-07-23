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
const emit = defineEmits(['success']);
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

const selectedTasks = ref(tasks.value);

const isLoading = ref(false);

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

  if (selectedTasks.value.length > SLOW_CLOSE_TASK_COUNT_THRESHOLD) {
    const estimatedMinutes = Math.ceil(selectedTasks.value.length * SECONDS_PER_TASK / 60);
    showToast({
      severity: 'info',
      summary: 'Задач много',
      detail: `Закрытие может занять до ${estimatedMinutes} ${pluralize(estimatedMinutes, ['минуты', 'минут', 'минут'])} — дождитесь завершения, не закрывайте окно.`,
      life: 8000,
    });
  }

  try {
    const taskIds = selectedTasks.value.map((task) => task.id);

    await bitrixApi.completeTasksBatch(taskIds);

    let failedApproveCount = 0;

    if (approveControlledTasks.value) {
      const controlledTaskIds = selectedTasks.value.filter((task) => task.taskControl).map((task) => task.id);
      if (controlledTaskIds.length) {
        const { failedIds } = await bitrixApi.approveTasksBatch(controlledTaskIds);
        failedApproveCount = failedIds.length;
      }
    }

    showToast({
      severity: failedApproveCount ? 'warn' : 'success',
      summary: 'Сохранено',
      detail: failedApproveCount
        ? `Задачи завершены, но не удалось подтвердить выполнение (нет прав постановщика/наблюдателя) для ${failedApproveCount} из них.`
        : 'Задачи успешно завершены.',
      life: 5000,
    });

    emit('success');
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
</script>

<template>
  <DataTable
    v-model:selection="selectedTasks"
    :value="tasks"
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
  >
    <template #header>
      <div class="flex items-center gap-3">
        <Button
          :loading="isLoading"
          icon="pi pi-flag"
          :label="`Завершить выбранные задачи (${selectedTasks.length})`"
          size="small"
          :disabled="!selectedTasks.length"
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
          class="pi pi-sitemap text-surface-400 mr-1"
        />
        <i
          v-if="data.taskControl"
          v-tooltip.top="'Требует подтверждения выполнения («Принять работу»)'"
          class="pi pi-verified text-surface-400 mr-1"
        />
        <a
          class="pts-blur"
          target="_top"
          :href="data.url"
          v-html="data.name"
        />
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
  </DataTable>
</template>

