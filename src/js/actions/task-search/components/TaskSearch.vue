<script setup>
import dayjs from 'dayjs';
import { isEqual } from 'lodash-es';
import { Avatar, Button, Column, DataTable, DatePicker, InputText, Select, ToggleSwitch } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import FormField from '../../../ui/FormField.vue';
import { getTaskUrl, pluralize } from '../../../utils.js';

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

const STATUS_OPTIONS = [
  { label: 'Все', value: null },
  { label: 'Не завершённые', value: 'active' },
  { label: 'Завершённые', value: 'closed' },
];

function getDefaults() {
  return {
    title: '',
    status: 'active',
    useGroupFilter: true,
    createdBy: null,
    responsibleId: null,
    createdDateRange: null,
    changedDateRange: null,
  };
}

const toast = useToast();
const bitrixApi = new BitrixApi(props.sessionId);

const form = reactive(getDefaults());

const isLoading = ref(false);
const isUsersLoading = ref(false);
const tasks = ref([]);
const groupUsers = ref([]);
const hasSearched = ref(false);

const userOptions = computed(() => groupUsers.value.map((u) => ({
  id: Number(u.ID),
  name: [u.NAME, u.LAST_NAME].filter(Boolean).join(' '),
  avatar: u.PERSONAL_PHOTO ?? '',
})));

onMounted(async () => {
  isUsersLoading.value = true;
  try {
    groupUsers.value = await bitrixApi.getGroupUsers(props.groupId);
  } catch (e) {
    console.warn('[task-search] failed to load group users:', e);
  } finally {
    isUsersLoading.value = false;
  }
});

async function search() {
  if (isEqual(form, getDefaults())) return;

  isLoading.value = true;
  hasSearched.value = true;

  try {
    tasks.value = await bitrixApi.searchTasks({
      title: form.title.trim() || null,
      status: form.status,
      groupId: form.useGroupFilter ? props.groupId : null,
      createdBy: form.createdBy,
      responsibleId: form.responsibleId,
      createdDateFrom: form.createdDateRange?.[0]
        ? dayjs(form.createdDateRange[0]).format('YYYY-MM-DD 00:00:00')
        : null,
      createdDateTo: form.createdDateRange?.[1]
        ? dayjs(form.createdDateRange[1]).format('YYYY-MM-DD 23:59:59')
        : null,
      changedDateFrom: form.changedDateRange?.[0]
        ? dayjs(form.changedDateRange[0]).format('YYYY-MM-DD 00:00:00')
        : null,
      changedDateTo: form.changedDateRange?.[1]
        ? dayjs(form.changedDateRange[1]).format('YYYY-MM-DD 23:59:59')
        : null,
    });
  } catch (e) {
    console.warn('[task-search]', e);
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

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return dayjs(dateStr).format('DD.MM.YYYY');
}
</script>

<template>
  <div>
    <div class="grid grid-cols-2 gap-3 mb-3">
      <FormField label="Название">
        <InputText
          v-model="form.title"
          size="small"
          placeholder="Поиск по названию..."
          class="w-full"
          @keydown.enter="search"
        />
      </FormField>
      <FormField label="Статус">
        <Select
          v-model="form.status"
          :options="STATUS_OPTIONS"
          option-label="label"
          option-value="value"
          size="small"
          class="w-full"
        />
      </FormField>
      <FormField label="Постановщик">
        <Select
          v-model="form.createdBy"
          :options="userOptions"
          option-label="name"
          option-value="id"
          placeholder="Любой"
          show-clear
          :loading="isUsersLoading"
          size="small"
          class="w-full"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.avatar"
                :image="option.avatar"
                shape="circle"
                size="small"
              />
              {{ option.name }}
            </div>
          </template>
        </Select>
      </FormField>
      <FormField label="Исполнитель">
        <Select
          v-model="form.responsibleId"
          :options="userOptions"
          option-label="name"
          option-value="id"
          placeholder="Любой"
          show-clear
          :loading="isUsersLoading"
          size="small"
          class="w-full"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.avatar"
                :image="option.avatar"
                shape="circle"
                size="small"
              />
              {{ option.name }}
            </div>
          </template>
        </Select>
      </FormField>
      <FormField label="Дата создания">
        <DatePicker
          v-model="form.createdDateRange"
          selection-mode="range"
          date-format="dd.mm.yy"
          :manual-input="false"
          show-button-bar
          size="small"
          class="w-full"
        />
      </FormField>
      <FormField label="Дата изменения">
        <DatePicker
          v-model="form.changedDateRange"
          selection-mode="range"
          date-format="dd.mm.yy"
          :manual-input="false"
          show-button-bar
          size="small"
          class="w-full"
        />
      </FormField>
    </div>

    <div class="flex gap-4 items-center mb-4">
      <div class="flex gap-2 items-center">
        <ToggleSwitch
          v-model="form.useGroupFilter"
          input-id="group-filter-toggle"
          size="small"
        />
        <label
          for="group-filter-toggle"
          class="text-sm"
          style="cursor: pointer;"
        >
          Только текущая группа
        </label>
      </div>
      <Button
        label="Найти"
        icon="pi pi-search"
        :loading="isLoading"
        size="small"
        @click="search"
      />
      <span
        v-if="hasSearched && !isLoading"
        class="text-sm text-muted-color"
      >
        {{ tasks.length }} {{ pluralize(tasks.length, ['задача', 'задачи', 'задач']) }}
      </span>
    </div>

    <DataTable
      :value="tasks"
      :loading="isLoading"
      data-key="id"
      sort-field="changedDate"
      :sort-order="-1"
      paginator
      :rows="25"
      :rows-per-page-options="[25, 50, 100]"
      size="small"
      style="min-width: 600px;"
    >
      <Column
        field="title"
        header="Название"
        sortable
        style="min-width: 280px;"
      >
        <template #body="{ data }">
          <a
            :href="getTaskUrl(data.groupId, data.id)"
            target="_top"
          >
            {{ data.title }}
          </a>
        </template>
      </Column>
      <Column
        field="responsible.name"
        header="Исполнитель"
        sortable
        style="min-width: 140px;"
      >
        <template #body="{ data }">
          <a
            v-if="data.responsible?.link"
            :href="data.responsible.link"
            target="_top"
          >
            {{ data.responsible?.name }}
          </a>
          <span v-else>{{ data.responsible?.name ?? '—' }}</span>
        </template>
      </Column>
      <Column
        field="createdDate"
        header="Создана"
        sortable
        style="min-width: 110px;"
      >
        <template #body="{ data }">
          {{ formatDate(data.createdDate) }}
        </template>
      </Column>
      <Column
        field="changedDate"
        header="Изменена"
        sortable
        style="min-width: 110px;"
      >
        <template #body="{ data }">
          {{ formatDate(data.changedDate) }}
        </template>
      </Column>

      <template #empty>
        <span v-if="hasSearched">Задачи не найдены</span>
        <span v-else>Введите параметры поиска и нажмите «Найти»</span>
      </template>
    </DataTable>
  </div>
</template>
