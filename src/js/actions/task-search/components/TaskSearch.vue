<script setup>
import dayjs from 'dayjs';
import {isEqual} from 'lodash-es';
import {
  Avatar,
  Badge,
  Button,
  Column,
  DataTable,
  Dialog,
  InputText,
  MultiSelect,
  Select,
  Skeleton,
  ToggleSwitch,
} from 'primevue';
import {computed, onMounted, reactive, ref, watch} from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import {showToast} from '../../../toastHost/showToast.js';
import DateRangePicker from '../../../ui/DateRangePicker.vue';
import FormField from '../../../ui/FormField.vue';
import {getTaskUrl, isHotfixTask, pluralize} from '../../../utils.js';
import SettingsForm from './SettingsForm.vue';

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
  {label: 'Все', value: null},
  {label: 'Не завершённые', value: 'active'},
  {label: 'Завершённые', value: 'closed'},
];

const PARENT_TYPE_OPTIONS = [
  {label: 'Все', value: 'all'},
  {label: 'Корневые', value: 'root'},
  {label: 'Подзадачи', value: 'subtask'},
];

const SETTINGS_KEY = 'task-search-settings';

// До v2.12 «Скрыть фильтры» хранилось отдельными булевыми полями (до v2.7.6 их не было вовсе) —
// сохранённые у части пользователей настройки нужно перевести в новый формат hiddenFilters
const LEGACY_HIDDEN_FILTER_KEYS = {
  hideExcludeTitle: 'excludeTitle',
  hideStatus: 'status',
  hideParentType: 'parentType',
  hideCreatedDate: 'createdDate',
  hideChangedDate: 'changedDate',
  hideExtendedSearch: 'extendedSearch',
};

function migrateHiddenFilters(storedSettings) {
  if (Array.isArray(storedSettings.hiddenFilters)) return storedSettings.hiddenFilters;

  return Object.entries(LEGACY_HIDDEN_FILTER_KEYS)
    .filter(([legacyKey]) => storedSettings[legacyKey])
    .map(([, hiddenFilterKey]) => hiddenFilterKey);
}

const bitrixApi = new BitrixApi(props.sessionId);

const settings = ref({});
const isSettingsModalOpened = ref(false);

function getDefaults() {
  return {
    title: '',
    excludeTitle: settings.value.defaultExcludeTitle ?? '',
    excludeHotfixes: false,
    smartTitleSearch: settings.value.defaultSmartSearch !== false,
    extendedSearch: settings.value.defaultExtendedSearch ?? false,
    status: settings.value.defaultStatus !== undefined ? settings.value.defaultStatus : 'active',
    parentType: settings.value.defaultParentType ?? 'all',
    useGroupFilter: settings.value.defaultUseGroupFilter !== false,
    createdBy: null,
    responsibleId: null,
    stageIds: [],
    createdDateRange: null,
    changedDateRange: null,
  };
}

const form = reactive(getDefaults());

const isLoading = ref(false);
const isUsersLoading = ref(false);
const isStagesLoading = ref(false);
const tasks = ref([]);
const groupUsers = ref([]);
const stages = ref([]);
const hasSearched = ref(false);
const filterFavorites = ref(false);
const currentUserId = ref(null);

const userOptions = computed(() => groupUsers.value.map((u) => ({
  id: Number(u.ID),
  name: [u.NAME, u.LAST_NAME].filter(Boolean).join(' '),
  avatar: u.PERSONAL_PHOTO ?? '',
})));

const stageMap = computed(() => Object.fromEntries(stages.value.map((s) => [String(s.id), s])));
const isInitialLoading = computed(() => isUsersLoading.value || isStagesLoading.value);
const isHiddenExcludeTitleActive = computed(
  () => !!settings.value.hiddenFilters?.includes('excludeTitle') && !!settings.value.defaultExcludeTitle?.trim(),
);
const displayedTasks = computed(
  () => form.excludeHotfixes ? tasks.value.filter((task) => !isHotfixTask(task.title)) : tasks.value,
);

onMounted(async () => {
  isUsersLoading.value = true;
  isStagesLoading.value = true;
  try {
    const [groupUsersResult, stagesResponse, stored, currentUser] = await Promise.all([
      bitrixApi.getGroupUsers(props.groupId),
      bitrixApi.getStages(props.groupId),
      chrome.storage.local.get(SETTINGS_KEY),
      bitrixApi.getCurrentUser(),
    ]);
    groupUsers.value = groupUsersResult;
    stages.value = Object.values(stagesResponse.data?.result ?? {})
      .sort((a, b) => a.SORT - b.SORT)
      .map((s) => ({id: s.ID, title: s.TITLE, color: `#${s.COLOR}`}));
    currentUserId.value = currentUser?.ID ? String(currentUser.ID) : null;
    if (stored[SETTINGS_KEY]) {
      settings.value = {
        ...stored[SETTINGS_KEY],
        hiddenFilters: migrateHiddenFilters(stored[SETTINGS_KEY]),
      };
      Object.assign(form, getDefaults());
    }
  } catch (e) {
    console.warn('[task-search] failed to load filters data:', e);
  } finally {
    isUsersLoading.value = false;
    isStagesLoading.value = false;
  }
});

function onSettingsSaved(newSettings) {
  settings.value = newSettings;
  Object.assign(form, getDefaults());
  isSettingsModalOpened.value = false;
}

function isTaskFavorite(task) {
  return filterFavorites.value
    || task.favorite === 'Y'
    || task.action?.deleteFavorite === true
    || task.action?.['favorite.delete'] === true;
}

async function toggleFavorite(task) {
  const isFav = isTaskFavorite(task);
  try {
    if (isFav) {
      await bitrixApi.unfavoriteTask(task.id);
      if (filterFavorites.value) {
        tasks.value = tasks.value.filter((t) => t.id !== task.id);
        return;
      }
    } else {
      await bitrixApi.favoriteTask(task.id);
    }
    task.favorite = isFav ? 'N' : 'Y';
    if (task.action) {
      task.action.deleteFavorite = !isFav;
    }
  } catch (e) {
    console.warn('[task-search] toggleFavorite failed:', e);
  }
}

watch(filterFavorites, () => search());

async function search() {
  if (!filterFavorites.value && isEqual(form, getDefaults())) {
    tasks.value = [];
    hasSearched.value = false;
    return;
  }

  if (isLoading.value) return;

  isLoading.value = true;
  hasSearched.value = true;

  try {
    const limit = settings.value.resultLimit !== undefined ? settings.value.resultLimit : 100;

    const baseParams = {
      favorite: filterFavorites.value,
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
      limit,
    };

    const requests = [bitrixApi.searchTasks(baseParams)];

    if (form.extendedSearch && form.title.trim()) {
      requests.push(
        bitrixApi.searchTasksByFulltext(form.title.trim()).then(({data}) => {
          const items = (data?.data?.items ?? []).filter((item) => item.type === 'TASK');
          if (!items.length) return [];
          const ids = limit ? items.slice(0, limit).map((item) => item.id) : items.map((item) => item.id);
          return bitrixApi.searchTasks({...baseParams, ids, title: null});
        }),
      );
    }

    const [standardResults, fulltextResults] = await Promise.all(requests);

    if (fulltextResults?.length) {
      const existingIds = new Set(standardResults.map((t) => t.id));
      tasks.value = [...standardResults, ...fulltextResults.filter((t) => !existingIds.has(t.id))];
    } else {
      tasks.value = standardResults;
    }
  } catch (e) {
    console.warn('[task-search]', e);
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

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return dayjs(dateStr).format('DD.MM.YYYY');
}
</script>

<template>
  <div>
    <template v-if="isInitialLoading">
      <Skeleton
        height="120px"
        class="mb-3"
      />
      <Skeleton height="300px" />
    </template>

    <template v-else>
      <div class="mb-3 flex items-center gap-2">
        <Button
          icon="pi pi-cog"
          size="small"
          severity="secondary"
          text
          label="Настройки"
          @click="isSettingsModalOpened = true"
        />
        <i
          v-if="isHiddenExcludeTitleActive"
          v-tooltip.top="`Скрытый фильтр активен: из результатов исключены задачи с «${settings.defaultExcludeTitle}» в названии`"
          class="pi pi-exclamation-triangle text-yellow-500"
        />
      </div>

      <div class="grid grid-cols-4 gap-3 mb-3">
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
          v-if="!settings.hiddenFilters?.includes('excludeTitle')"
          label="Исключить из названия"
          tip="Слова через пробел: задачи, содержащие хотя бы одно из них, будут исключены"
        >
          <InputText
            v-model="form.excludeTitle"
            size="small"
            placeholder="Исключить задачи с этим в названии..."
            class="w-full"
            @keydown.enter="search"
          />
        </FormField>
        <FormField
          v-if="!settings.hiddenFilters?.includes('status')"
          label="Статус"
        >
          <Select
            v-model="form.status"
            :options="STATUS_OPTIONS"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
          />
        </FormField>
        <FormField
          v-if="!settings.hiddenFilters?.includes('parentType')"
          label="Тип задачи"
        >
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
          label="Колонка канбана"
          :tip="!form.useGroupFilter ? 'Доступно только при включённом фильтре «Только текущая группа»' : ''"
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
            :disabled="!form.useGroupFilter"
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
        <FormField
          v-if="!settings.hiddenFilters?.includes('createdDate')"
          label="Дата создания"
        >
          <DateRangePicker
            v-model="form.createdDateRange"
            presets="current"
          />
        </FormField>
        <FormField
          v-if="!settings.hiddenFilters?.includes('changedDate')"
          label="Дата изменения"
        >
          <DateRangePicker
            v-model="form.changedDateRange"
            presets="current"
          />
        </FormField>
        <div class="flex gap-2 items-center self-end">
          <ToggleSwitch
            v-model="form.useGroupFilter"
            input-id="group-filter-toggle"
            size="small"
          />
          <label
            for="group-filter-toggle"
            class="text-sm cursor-pointer"
          >
            Только текущая группа
          </label>
        </div>
        <div class="flex gap-2 items-center self-end">
          <ToggleSwitch
            v-model="form.smartTitleSearch"
            input-id="smart-title-toggle"
            size="small"
          />
          <label
            v-tooltip.top="'Разбивает запрос на слова и ищет каждое отдельно — порядок не важен'"
            for="smart-title-toggle"
            class="text-sm cursor-pointer"
          >
            Искать по каждому слову
          </label>
        </div>
        <div
          v-if="!settings.hiddenFilters?.includes('extendedSearch')"
          class="flex gap-2 items-center self-end"
        >
          <ToggleSwitch
            v-model="form.extendedSearch"
            input-id="extended-search-toggle"
            size="small"
          />
          <label
            v-tooltip.top="'Дополнительно ищет по описанию и комментариям задачи. Поиск только по точной фразе — разбивка на слова не применяется'"
            for="extended-search-toggle"
            class="text-sm cursor-pointer"
          >
            Искать в описании и комментариях
          </label>
        </div>
        <div
          v-if="!settings.hiddenFilters?.includes('excludeHotfixes')"
          class="flex gap-2 items-center self-end"
        >
          <ToggleSwitch
            v-model="form.excludeHotfixes"
            input-id="exclude-hotfixes-toggle"
            size="small"
          />
          <label
            v-tooltip.top="'Скрывает задачи, название которых начинается с «Hotfix»'"
            for="exclude-hotfixes-toggle"
            class="text-sm cursor-pointer"
          >
            Исключить хотфиксы
          </label>
        </div>
        <div class="flex gap-2 items-center self-end">
          <ToggleSwitch
            v-model="filterFavorites"
            input-id="favorites-toggle"
            size="small"
          />
          <label
            for="favorites-toggle"
            class="text-sm cursor-pointer"
          >
            <i class="pi pi-star-fill text-yellow-400 text-sm" />
            Избранные
          </label>
        </div>
        <div class="flex gap-3 items-center self-end">
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
            {{ displayedTasks.length }} {{ pluralize(displayedTasks.length, ['задача', 'задачи', 'задач']) }}
          </span>
        </div>
      </div>

      <DataTable
        :value="displayedTasks"
        :loading="isLoading"
        data-key="id"
        sort-field="changedDate"
        :sort-order="-1"
        paginator
        :rows="25"
        :rows-per-page-options="[25, 50, 100]"
        size="small"
        striped-rows
        style="min-width: 600px;"
      >
        <Column style="width: 36px; min-width: 36px;">
          <template #body="{ data }">
            <button
              class="bg-transparent border-0 p-0 cursor-pointer leading-none flex items-center"
              @click.prevent="toggleFavorite(data)"
            >
              <i :class="isTaskFavorite(data) ? 'pi pi-star-fill text-yellow-400' : 'pi pi-star text-gray-400'" />
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
            <i
              v-if="String(data.parentId ?? 0) === '0'"
              v-tooltip.top="'Корневая задача'"
              class="pi pi-sitemap text-surface-400 mr-1"
            />
            <a
              class="pts-blur"
              :href="getTaskUrl(data.groupId, data.id, currentUserId)"
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
    </template>

    <Dialog
      v-model:visible="isSettingsModalOpened"
      header="Настройки поиска"
      modal
      dismissable-mask
    >
      <SettingsForm
        :initial="settings"
        @success="onSettingsSaved"
      />
    </Dialog>
  </div>
</template>
