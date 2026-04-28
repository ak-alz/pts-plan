<script setup>
import dayjs from 'dayjs';
import { isEqual } from 'lodash-es';
import { Avatar, Badge, Button, Column, DataTable, DatePicker, InputText, MultiSelect, Select, ToggleSwitch } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref, watch } from 'vue';

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

const PARENT_TYPE_OPTIONS = [
  { label: 'Все', value: 'all' },
  { label: 'Корневые', value: 'root' },
  { label: 'Подзадачи', value: 'subtask' },
];

function getDefaults() {
  return {
    title: '',
    excludeTitle: '',
    smartTitleSearch: true,
    status: 'active',
    parentType: 'all',
    useGroupFilter: true,
    createdBy: null,
    responsibleId: null,
    stageIds: [],
    createdDateRange: null,
    changedDateRange: null,
  };
}

const FAVORITES_KEY = 'taskSearchFavorites';

const toast = useToast();
const bitrixApi = new BitrixApi(props.sessionId);

const form = reactive(getDefaults());

const isLoading = ref(false);
const isUsersLoading = ref(false);
const isStagesLoading = ref(false);
const tasks = ref([]);
const groupUsers = ref([]);
const stages = ref([]);
const hasSearched = ref(false);
const favorites = ref(new Set());
const filterFavorites = ref(false);

const userOptions = computed(() => groupUsers.value.map((u) => ({
  id: Number(u.ID),
  name: [u.NAME, u.LAST_NAME].filter(Boolean).join(' '),
  avatar: u.PERSONAL_PHOTO ?? '',
})));

const stageMap = computed(() => Object.fromEntries(stages.value.map((s) => [String(s.id), s])));

onMounted(async () => {
  isUsersLoading.value = true;
  isStagesLoading.value = true;
  try {
    const [groupUsersResult, stagesResponse, stored] = await Promise.all([
      bitrixApi.getGroupUsers(props.groupId),
      bitrixApi.getStages(props.groupId),
      chrome.storage.local.get(FAVORITES_KEY),
    ]);
    groupUsers.value = groupUsersResult;
    stages.value = Object.values(stagesResponse.data?.result ?? {})
      .sort((a, b) => a.SORT - b.SORT)
      .map((s) => ({ id: s.ID, title: s.TITLE, color: `#${s.COLOR}` }));
    favorites.value = new Set((stored[FAVORITES_KEY] ?? []).map(String));
  } catch (e) {
    console.warn('[task-search] failed to load filters data:', e);
  } finally {
    isUsersLoading.value = false;
    isStagesLoading.value = false;
  }
});

async function toggleFavorite(taskId) {
  const id = String(taskId);
  if (favorites.value.has(id)) {
    favorites.value.delete(id);
  } else {
    favorites.value.add(id);
  }
  favorites.value = new Set(favorites.value);
  await chrome.storage.local.set({ [FAVORITES_KEY]: [...favorites.value] });
}

watch(filterFavorites, (val) => {
  if (val) search();
});

async function search() {
  if (!filterFavorites.value && isEqual(form, getDefaults())) return;
  if (filterFavorites.value && !favorites.value.size) {
    tasks.value = [];
    hasSearched.value = true;
    return;
  }

  isLoading.value = true;
  hasSearched.value = true;

  try {
    tasks.value = await bitrixApi.searchTasks(filterFavorites.value
      ? { ids: [...favorites.value] }
      : {
          title: form.title.trim() || null,
          excludeTitle: form.excludeTitle.trim() || null,
          smartTitleSearch: form.smartTitleSearch,
          status: form.status,
          parentType: form.parentType,
          groupId: form.useGroupFilter ? props.groupId : null,
          createdBy: form.createdBy,
          responsibleId: form.responsibleId,
          stageIds: form.useGroupFilter ? form.stageIds : [],
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
    <div class="flex gap-2 items-center mb-3">
      <ToggleSwitch
        v-model="filterFavorites"
        input-id="favorites-toggle"
        size="small"
      />
      <label
        for="favorites-toggle"
        class="text-sm"
        style="cursor: pointer;"
      >
        <i
          class="pi pi-star-fill"
          style="color: #facc15; font-size: 0.85em;"
        /> Избранные
      </label>
    </div>

    <div
      v-if="!filterFavorites"
      class="grid grid-cols-3 gap-3 mb-3"
    >
      <FormField label="Название">
        <InputText
          v-model="form.title"
          size="small"
          placeholder="Поиск по названию..."
          class="w-full"
          @keydown.enter="search"
        />
      </FormField>
      <FormField
        v-tooltip.top="'Слова через пробел: задачи, содержащие хотя бы одно из них, будут исключены'"
        label="Исключить из названия"
      >
        <InputText
          v-model="form.excludeTitle"
          size="small"
          placeholder="Исключить задачи с этим в названии..."
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
      <FormField label="Тип задачи">
        <Select
          v-model="form.parentType"
          :options="PARENT_TYPE_OPTIONS"
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
      <FormField
        v-if="form.useGroupFilter"
        label="Колонка канбана"
      >
        <MultiSelect
          v-model="form.stageIds"
          :options="stages"
          option-label="title"
          option-value="id"
          placeholder="Любая"
          filter
          filter-placeholder="Поиск"
          :max-selected-labels="3"
          :loading="isStagesLoading"
          show-clear
          size="small"
          class="w-full"
        >
          <template #option="{ option }">
            <div class="flex gap-2 items-center">
              <Badge :style="`background-color: ${option.color};`" />
              {{ option.title }}
            </div>
          </template>
        </MultiSelect>
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
      <div
        v-if="!filterFavorites"
        class="flex gap-2 items-center"
      >
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
      <div
        v-if="!filterFavorites"
        class="flex gap-2 items-center"
      >
        <ToggleSwitch
          v-model="form.smartTitleSearch"
          input-id="smart-title-toggle"
          size="small"
        />
        <label
          v-tooltip.top="'Разбивает запрос на слова: в названии задачи должно встретиться каждое слово, но порядок не важен'"
          for="smart-title-toggle"
          class="text-sm"
          style="cursor: pointer;"
        >
          Искать по каждому слову
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
      <Column style="width: 36px; min-width: 36px;">
        <template #body="{ data }">
          <button
            style="background: none; border: none; padding: 0; cursor: pointer; line-height: 1; display: flex; align-items: center;"
            @click.prevent="toggleFavorite(data.id)"
          >
            <i
              :class="favorites.has(String(data.id)) ? 'pi pi-star-fill' : 'pi pi-star'"
              :style="favorites.has(String(data.id)) ? 'color: #facc15;' : 'color: #9ca3af;'"
            />
          </button>
        </template>
      </Column>
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
        field="stageId"
        header="Колонка"
        sortable
        style="min-width: 140px;"
      >
        <template #body="{ data }">
          <template v-if="stageMap[data.stageId]">
            <div class="flex gap-2 items-center">
              <Badge :style="`background-color: ${stageMap[data.stageId].color};`" />
              {{ stageMap[data.stageId].title }}
            </div>
          </template>
          <span v-else>—</span>
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
