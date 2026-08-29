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
import { usePersonalGroupFilter } from '../../../composables/usePersonalGroupFilter.js';
import { collectStagesFromTasks } from '../../../personalPlan.js';
import {showToast} from '../../../toastHost/showToast.js';
import DateRangePicker from '../../../ui/DateRangePicker.vue';
import FormField from '../../../ui/FormField.vue';
import PersonalScopeWarning from '../../../ui/PersonalScopeWarning.vue';
import {getTaskUrl, isHotfixTask, pluralize} from '../../../utils.js';
import SettingsForm from './SettingsForm.vue';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  context: {
    type: Object,
    required: true,
  },
});

const isPersonal = computed(() => props.context.type === 'personal');

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

// В личный план попадают задачи разных групп — фильтр сужает поиск до одной. Пусто означает
// «все группы». Выбранная группа заодно возвращает фильтры, которых на личном плане не было:
// её колонки и её участников
const { groupOptions, selectedGroupId, restoreGroupFilter } = usePersonalGroupFilter(
  bitrixApi,
  `task-search-group-${props.context.id}`,
);
// Фильтры по группе доступны либо на групповом канбане, либо когда на личном выбрана группа
const hasGroupScope = computed(() => !isPersonal.value || !!selectedGroupId.value);

const settings = ref({});
const isSettingsModalOpened = ref(false);

function getDefaults() {
  return {
    title: '',
    excludeTitle: settings.value.defaultExcludeTitle ?? '',
    excludeHotfixes: settings.value.defaultExcludeHotfixes ?? false,
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

const userOptions = computed(() => groupUsers.value.map((user) => ({
  id: Number(user.ID),
  name: [user.NAME, user.LAST_NAME].filter(Boolean).join(' '),
  avatar: user.PERSONAL_PHOTO ?? '',
})));

const stageMap = computed(() => Object.fromEntries(stages.value.map((stage) => [String(stage.id), stage])));
const isInitialLoading = computed(() => isUsersLoading.value || isStagesLoading.value);
const isHiddenExcludeTitleActive = computed(
  () => !!settings.value.hiddenFilters?.includes('excludeTitle') && !!settings.value.defaultExcludeTitle?.trim(),
);
// Фильтр скрыт настройками, но включён по умолчанию — иначе задачи резались бы без видимой причины
const isHiddenExcludeHotfixesActive = computed(
  () => !!settings.value.hiddenFilters?.includes('excludeHotfixes') && form.excludeHotfixes,
);
// Поле сортировки — общее для запроса и для таблицы результатов, иначе сервер отдаст топ-N
// по одному полю, а таблица покажет его отсортированным по другому
const sortField = computed(() => settings.value.sortField ?? 'CREATED_DATE');
const tableSortField = computed(() => (sortField.value === 'CHANGED_DATE' ? 'changedDate' : 'createdDate'));
const displayedTasks = computed(
  () => form.excludeHotfixes ? tasks.value.filter((task) => !isHotfixTask(task.title)) : tasks.value,
);
const groupFilterLabel = computed(() => isPersonal.value ? 'Только мой план' : 'Только текущая группа');

onMounted(async () => {
  isUsersLoading.value = true;
  isStagesLoading.value = true;
  try {
    const [groupUsersResult, stagesResponse, stored, currentUser] = await Promise.all([
      // На личном плане списка участников группы нет — фильтры «Постановщик»/«Исполнитель» скрыты
      isPersonal.value ? Promise.resolve([]) : bitrixApi.getGroupUsers(props.context.id),
      isPersonal.value ? Promise.resolve(null) : bitrixApi.getStages(props.context.id),
      chrome.storage.local.get(SETTINGS_KEY),
      bitrixApi.getCurrentUser(),
      isPersonal.value ? restoreGroupFilter() : Promise.resolve(),
    ]);
    groupUsers.value = groupUsersResult;
    // На личном плане stagesResponse нет — там колонки грузит loadGroupReferences() по выбранной
    // группе, и присваивание пустого массива затёрло бы их
    if (stagesResponse) {
      stages.value = Object.values(stagesResponse.data?.result ?? {})
        .sort((a, b) => a.SORT - b.SORT)
        .map((stage) => ({id: stage.ID, title: stage.TITLE, name: stage.TITLE, color: `#${stage.COLOR}`}));
    }
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

// Справочники выбранной группы: без них на личном плане нечем наполнить фильтры по колонке и
// по участникам. Один раз на смену группы, а не на каждый поиск
async function loadGroupReferences() {
  if (!selectedGroupId.value) {
    stages.value = [];
    groupUsers.value = [];
    return;
  }

  isStagesLoading.value = true;
  isUsersLoading.value = true;
  try {
    const [stagesResponse, users] = await Promise.all([
      bitrixApi.getStages(selectedGroupId.value),
      bitrixApi.getGroupUsers(selectedGroupId.value),
    ]);
    stages.value = Object.values(stagesResponse.data?.result ?? {})
      .sort((a, b) => a.SORT - b.SORT)
      .map((stage) => ({id: stage.ID, title: stage.TITLE, name: stage.TITLE, color: `#${stage.COLOR}`}));
    groupUsers.value = users;
  } catch (e) {
    console.warn('[task-search] failed to load group references:', e);
  } finally {
    isStagesLoading.value = false;
    isUsersLoading.value = false;
  }
}

// Колонки и участники прошлой группы к новой отношения не имеют — иначе оставшийся выбор
// отфильтровал бы выдачу в ноль
watch(selectedGroupId, async () => {
  form.stageIds = [];
  form.createdBy = null;
  form.responsibleId = null;
  await loadGroupReferences();
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
        tasks.value = tasks.value.filter((item) => item.id !== task.id);
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

// На личном плане тогл «Только мой план» переключает не GROUP_ID (там его нет), а то, применять ли
// объединение 4 ролей (ответственный/соисполнитель/наблюдатель/постановщик) — см. searchMyTasks()
// в BitrixApi.js. Выключенный тогл — обычный глобальный поиск, как и для группы
function runSearch(params) {
  return isPersonal.value && form.useGroupFilter
    ? bitrixApi.searchMyTasks(props.context.id, params)
    : bitrixApi.searchTasks(params);
}

async function search() {
  if (!filterFavorites.value && !selectedGroupId.value && isEqual(form, getDefaults())) {
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
      groupId: isPersonal.value ? selectedGroupId.value : (form.useGroupFilter ? props.context.id : null),
      createdBy: form.createdBy,
      responsibleId: form.responsibleId,
      // Колонки берутся из канбана конкретной группы: на групповом канбане это текущая группа,
      // на личном — выбранная в фильтре. Своих колонок у «Моего плана» нет
      stageIds: hasGroupScope.value && (isPersonal.value || form.useGroupFilter) ? form.stageIds : [],
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
      // Без сортировки Bitrix отдаёт задачи в своём порядке, и limit отрезает случайный срез,
      // а не самые старые задачи
      order: { field: sortField.value, direction: 'DESC' },
    };

    const requests = [runSearch(baseParams)];

    if (form.extendedSearch && form.title.trim()) {
      requests.push(
        bitrixApi.searchTasksByFulltext(form.title.trim()).then(({data}) => {
          const items = (data?.data?.items ?? []).filter((item) => item.type === 'TASK');
          if (!items.length) return [];
          const ids = limit ? items.slice(0, limit).map((item) => item.id) : items.map((item) => item.id);
          // Тот же runSearch, что и в основной ветке: полнотекстовый поиск сам по себе ничего не
          // знает про «мой план» и без этого возвращал бы чужие задачи при включённом тогле
          return runSearch({...baseParams, ids, title: null});
        }),
      );
    }

    const [standardResults, fulltextResults] = await Promise.all(requests);

    if (fulltextResults?.length) {
      const existingIds = new Set(standardResults.map((task) => task.id));
      tasks.value = [...standardResults, ...fulltextResults.filter((task) => !existingIds.has(task.id))];
    } else {
      tasks.value = standardResults;
    }

    // Когда группа не выбрана, результаты приходят из разных канбанов и колонки известны только
    // из самих задач — нужны для столбца «Колонка» в таблице, у каждой в названии есть группа.
    // С выбранной группой её колонки уже загружены (loadGroupReferences), перезаписывать нельзя:
    // список колонок в фильтре схлопнулся бы до попавших в выдачу
    if (isPersonal.value && !selectedGroupId.value) {
      stages.value = await collectStagesFromTasks(bitrixApi, tasks.value).catch(() => []);
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

function formatDate(dateString) {
  if (!dateString) return '—';
  return dayjs(dateString).format('DD.MM.YYYY');
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
        <i
          v-if="isHiddenExcludeHotfixesActive"
          v-tooltip.top="'Скрытый фильтр активен: из результатов исключены хотфиксы'"
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
        <FormField
          v-if="isPersonal"
          label="Группа"
          tip="В личный план попадают задачи разных групп. Пусто — ищем по всем. Выбор группы включает фильтры по её колонке и участникам"
        >
          <Select
            v-model="selectedGroupId"
            :options="groupOptions"
            option-label="name"
            option-value="id"
            placeholder="Все группы"
            show-clear
            filter
            filter-placeholder="Поиск"
            size="small"
            class="w-full"
          />
        </FormField>
        <FormField
          v-if="hasGroupScope"
          label="Постановщик"
        >
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
                />
                {{ option.name }}
              </div>
            </template>
          </Select>
        </FormField>
        <FormField
          v-if="hasGroupScope"
          label="Исполнитель"
        >
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
                />
                {{ option.name }}
              </div>
            </template>
          </Select>
        </FormField>
        <FormField
          v-if="hasGroupScope"
          label="Колонка канбана"
          :tip="!isPersonal && !form.useGroupFilter ? 'Доступно только при включённом фильтре «Только текущая группа»' : ''"
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
            :disabled="!isPersonal && !form.useGroupFilter"
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
            {{ groupFilterLabel }}
          </label>
          <PersonalScopeWarning v-if="isPersonal && form.useGroupFilter" />
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
        :sort-field="tableSortField"
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
              class="pi pi-sitemap text-surface-400 dark:text-surface-500 mr-1"
            />
            <a
              class="pts-blur"
              :href="getTaskUrl(isPersonal ? null : data.groupId, data.id, currentUserId)"
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
                {{ stageMap[data.stageId].name }}
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
