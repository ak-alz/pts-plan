<script setup>
import { round } from 'lodash-es';
import { Button, Column, DataTable } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, inject, ref } from 'vue';

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

const emits = defineEmits(['success']);

const toast = useToast();
const groupId = inject('groupId');
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

const progress = ref(null);
const isLoading = ref(false);

async function completeSelectedTasks() {
  progress.value = null;
  isLoading.value = true;

  try {
    const promises = selectedTasks.value
      .map((task) => {
        return bitrixApi.completeTask(groupId, props.column.id, task.id)
          .finally(() => {
            progress.value += round(100 / selectedTasks.value.length);
          });
      });

    progress.value = 0;
    await Promise.allSettled(promises);
    progress.value = 100;

    toast.add({
      severity: 'success',
      summary: 'Сохранено',
      detail: 'Задачи успешно завершены.',
      life: 5000,
    });

    emits('success');
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
  >
    <template #header>
      <Button
        :loading="isLoading"
        icon="pi pi-flag"
        :label="`Завершить выбранные задачи (${selectedTasks.length})`"
        size="small"
        :disabled="!selectedTasks.length"
        @click="completeSelectedTasks"
      />
    </template>

    <template
      v-if="typeof progress === 'number'"
      #loading
    >
      {{ progress }}%
    </template>

    <Column selection-mode="multiple" />
    <Column
      field="name"
      header="Задача"
    >
      <template #body="{data}">
        <a
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

<style scoped>

</style>
