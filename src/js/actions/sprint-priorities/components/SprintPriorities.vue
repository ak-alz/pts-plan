<script setup>
import dayjs from 'dayjs';
import { chunk, debounce, pick } from 'lodash-es';
import { Avatar, Button, Column, DataTable, Dialog, InputText, MultiSelect, SplitButton } from 'primevue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { AI_ESTIMATION_COLUMN_KEYS, AI_ESTIMATION_COLUMNS, AI_ESTIMATION_OUTDATED_NOTE, findLatestAiEstimation, formatAiEstimationValue, getAiEstimationValues } from '../../../aiEstimation.js';
import { backgroundFetch } from '../../../backgroundFetch.js';
import BitrixApi from '../../../BitrixApi.js';
import { showToast } from '../../../toastHost/showToast.js';
import { formatBytes, getInaccessibleTaskTitle, getTaskIdFromUrl, getTaskPointsFromName, getTaskUrl, simplifyColumnName } from '../../../utils.js';
import { buildCacheSignature, clearCache, getCacheSizeBytes, loadCache, saveCache } from '../cache.js';
import PriorityDistribution from './PriorityDistribution.vue';
import SettingsForm from './SettingsForm.vue';
import TeamPoints from './TeamPoints.vue';

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

// Первые 3 колонки всегда видимы, не выносятся в настройки
const LOCKED_COLUMN_KEYS = ['priority', 'title', 'stage'];

const ALL_COLUMNS = [
  { key: 'priority', label: '№' },
  { key: 'title', label: 'Задача' },
  { key: 'stage', label: 'Колонка' },
  { key: 'responsible', label: 'Исполнитель' },
  { key: 'createdBy', label: 'Постановщик' },
  { key: 'createdDate', label: 'Создана' },
  { key: 'changedDate', label: 'Изменена' },
];

// Только настраиваемые колонки передаются в SettingsForm
const CONFIGURABLE_COLUMNS = ALL_COLUMNS.filter((column) => !LOCKED_COLUMN_KEYS.includes(column.key));
const DEFAULT_HIDDEN_COLUMNS = ['changedDate', 'createdBy'];

const bitrixApi = new BitrixApi(props.sessionId);

const settingsStorageKey = computed(() => `sprint-priorities-settings-${props.groupId}`);
const markedRowStorageKey = computed(() => `sprint-priorities-mark-${props.groupId}`);
// Фильтр по исполнителю запоминаем: типичный сценарий — каждый раз открыть «мои задачи в спринте»
const responsibleFilterStorageKey = computed(() => `sprint-priorities-responsible-filter-${props.groupId}`);
const settings = ref(null);
const isSheetLoading = ref(false);
const isTasksLoading = ref(false);
const isTeamLoading = ref(false);
const isLoading = computed(() => isSheetLoading.value || isTasksLoading.value);
const dateUpdated = ref(null);
const cachedAt = ref(null);
const cacheSizeBytes = ref(0);
const isSettingsModalOpened = ref(false);

const REFRESH_STORAGE_KEY = 'sprint-priorities-last-refresh';
const lastRefreshKey = ref('all');

const sheetRows = ref([]);
const enrichedRows = ref([]);
const teamRows = ref([]);
const teamTasksRaw = ref([]);
const groupUsers = ref([]);
const groupStages = ref([]);
const firstRow = ref(0);
const rowsPerPage = ref(25);

const titleFilter = ref('');
const stageFilter = ref([]);
const responsibleFilter = ref([]);
const isDistributionModalOpened = ref(false);

const selectedTeamUser = ref(null);
const selectedTeamStage = ref(null);
const isTeamUserModalOpened = ref(false);

const markedRowTaskId = ref(null);

const visibleColumnKeys = computed(() => {
  const configured = settings.value?.visibleColumns
    ?? CONFIGURABLE_COLUMNS.map((column) => column.key).filter((key) => !DEFAULT_HIDDEN_COLUMNS.includes(key));
  return [...LOCKED_COLUMN_KEYS, ...configured];
});

// Выбранные поля ИИ-оценки выводятся одной колонкой через разделитель, в порядке AI_ESTIMATION_COLUMNS
const selectedAiFields = computed(() => AI_ESTIMATION_COLUMNS.filter((field) => settings.value?.aiFields?.includes(field.key)));
const AI_VALUES_SEPARATOR = ' · ';

const aiHeaderTooltip = computed(() => [
  selectedAiFields.value.map((field) => field.name).join(AI_VALUES_SEPARATOR),
  'Последняя ИИ-оценка задачи — из комментария или из описания. Загружается только для текущей страницы, сортировки нет.',
  AI_ESTIMATION_OUTDATED_NOTE,
].join('\n\n'));

// ИИ-оценка требует комментариев задачи, а на сотнях задач это минуты — считаем её только для текущей
// страницы таблицы. Небольшие порции по нескольку задач: ячейки заполняются по мере ответа, а не разом в конце
const AI_CHUNK_SIZE = 5;
const AI_CONCURRENCY = 3;
const tableRef = ref(null);
const aiValuesByTaskId = ref({});
// Значения из кэша или прошлой загрузки: показываются, пока для задачи не пришли свежие
const staleAiValuesByTaskId = ref({});
const aiLoadingTaskIds = ref({});
let aiLoadGeneration = 0;

// processedData — данные таблицы уже после её собственной сортировки, так страница совпадает с тем, что на экране
const pageTaskIds = computed(() => {
  const rows = tableRef.value?.processedData ?? filteredRows.value;
  return rows.slice(firstRow.value, firstRow.value + rowsPerPage.value)
    .filter((row) => row.title)
    .map((row) => row.taskId);
});

const cacheSignature = computed(() => buildCacheSignature(settings.value, visibleColumnKeys.value));

const cacheSizeLabel = computed(() => {
  return formatBytes(cacheSizeBytes.value);
});

const cachedAtLabel = computed(() => {
  if (!cachedAt.value) return '';
  const savedAt = dayjs(cachedAt.value);
  return savedAt.isSame(dayjs(), 'day') ? savedAt.format('HH:mm') : savedAt.format('DD.MM HH:mm');
});

const stageOptions = computed(() => {
  const stagesMap = new Map();
  enrichedRows.value.forEach((row) => {
    if (row.stage?.name && !stagesMap.has(row.stage.name)) {
      stagesMap.set(row.stage.name, row.stage.color ?? null);
    }
  });

  // Порядок колонок в канбане — по индексу в groupStages (уже отсортирован по SORT)
  const stageOrder = groupStages.value.map((stage) => stage.name);
  const stageOrderIndex = (name) => {
    const index = stageOrder.indexOf(name);
    return index === -1 ? stageOrder.length : index;
  };

  return [...stagesMap.entries()]
    .map(([name, color]) => ({ name, color }))
    .sort((a, b) => stageOrderIndex(a.name) - stageOrderIndex(b.name));
});

const responsibleOptions = computed(() => {
  const byId = new Map();
  enrichedRows.value.forEach((row) => {
    if (row.responsible?.id && !byId.has(row.responsible.id)) byId.set(row.responsible.id, row.responsible);
  });
  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
});

const scopeRows = computed(() => {
  let rows = enrichedRows.value;

  const query = titleFilter.value.trim().toLowerCase();
  if (query) {
    rows = rows.filter((row) => row.title?.toLowerCase().includes(query));
  }

  if (stageFilter.value.length) {
    rows = rows.filter((row) => stageFilter.value.includes(row.stageName));
  }

  return rows;
});

const filteredRows = computed(() => {
  if (!responsibleFilter.value.length) return scopeRows.value;
  return scopeRows.value.filter((row) => responsibleFilter.value.includes(row.responsible?.id));
});

const teamSelectedStages = computed(() => {
  const stageIds = settings.value?.teamStages ?? [];
  return groupStages.value
    .filter((stage) => stageIds.includes(stage.id))
    .map((stage) => ({ ...stage, shortName: simplifyColumnName(stage.name) }));
});

const selectedUserStageTasks = computed(() => {
  if (!selectedTeamUser.value) return [];
  return teamTasksRaw.value
    .filter((task) => {
      const isUserMatch = String(task.responsible?.id) === String(selectedTeamUser.value.id);
      const isStageMatch = !selectedTeamStage.value || String(task.stageId) === String(selectedTeamStage.value.id);
      return isUserMatch && isStageMatch;
    })
    .map((task) => ({
      id: task.id,
      title: task.title,
      url: getTaskUrl(props.groupId, task.id),
      points: getTaskPointsFromName(task.title),
      isRootTask: String(task.parentId ?? 0) === '0',
    }))
    .sort((a, b) => b.points - a.points);
});

watch([titleFilter, stageFilter, responsibleFilter], () => {
  firstRow.value = 0;
});

watch(responsibleFilter, (value) => {
  chrome.storage.local.set({ [responsibleFilterStorageKey.value]: [...value] });
});

async function toggleRowMark(taskId) {
  markedRowTaskId.value = markedRowTaskId.value === taskId ? null : taskId;
  if (markedRowTaskId.value) {
    await chrome.storage.local.set({ [markedRowStorageKey.value]: markedRowTaskId.value });
  } else {
    await chrome.storage.local.remove(markedRowStorageKey.value);
  }
}

async function restoreMarkedRow() {
  const stored = await chrome.storage.local.get([markedRowStorageKey.value]);
  const savedTaskId = stored[markedRowStorageKey.value] ?? null;
  if (!savedTaskId) return;
  const taskExists = enrichedRows.value.some((row) => row.taskId === savedTaskId);
  if (taskExists) {
    markedRowTaskId.value = savedTaskId;
  } else {
    await chrome.storage.local.remove(markedRowStorageKey.value);
  }
}


async function loadSettings() {
  const stored = await chrome.storage.local.get([settingsStorageKey.value]);
  settings.value = stored[settingsStorageKey.value] ?? null;
}

async function refreshCacheSize() {
  cacheSizeBytes.value = await getCacheSizeBytes(props.groupId);
}

async function resetCache() {
  await clearCache(props.groupId);
  await refreshCacheSize();
  showToast({
    severity: 'success',
    summary: 'Кэш очищен',
    detail: 'Сохранённый результат удалён. При следующем открытии таблица дождётся загрузки.',
    life: 5000,
  });
}

async function restoreFromCache() {
  const cache = await loadCache(props.groupId, cacheSignature.value);
  if (!cache) return;

  sheetRows.value = cache.sheetRows ?? [];
  enrichedRows.value = cache.enrichedRows ?? [];
  teamRows.value = cache.teamRows ?? [];
  teamTasksRaw.value = cache.teamTasksRaw ?? [];
  groupUsers.value = cache.groupUsers ?? [];
  groupStages.value = cache.groupStages ?? [];
  staleAiValuesByTaskId.value = cache.aiValuesByTaskId ?? {};
  cachedAt.value = cache.savedAt;
  await restoreMarkedRow();
}

async function persistCache() {
  if (!settings.value?.sheetUrl || !enrichedRows.value.length) return;
  // На экране всё ещё прошлый результат — загрузка не дошла до конца, перезаписывать его нечем
  if (cachedAt.value) return;

  await saveCache(props.groupId, cacheSignature.value, {
    sheetRows: sheetRows.value,
    enrichedRows: enrichedRows.value,
    teamRows: teamRows.value,
    teamTasksRaw: teamTasksRaw.value,
    groupUsers: groupUsers.value,
    groupStages: groupStages.value,
    // Только задачи текущей таблицы — иначе в кэше копились бы оценки всех прошлых спринтов
    aiValuesByTaskId: pick(
      { ...staleAiValuesByTaskId.value, ...aiValuesByTaskId.value },
      enrichedRows.value.map((row) => row.taskId),
    ),
  });
  await refreshCacheSize();
}

async function fetchGroupMeta() {
  const [rawUsers, stagesResponse] = await Promise.all([
    bitrixApi.getGroupUsers(props.groupId),
    bitrixApi.getStages(props.groupId),
  ]);

  groupUsers.value = rawUsers.map((user) => ({
    id: user.ID,
    name: [user.NAME, user.LAST_NAME].filter(Boolean).join(' '),
    photo: user.PERSONAL_PHOTO || null,
  }));

  groupStages.value = Object.values(stagesResponse.data.result)
    .sort((a, b) => a.SORT - b.SORT)
    .map((stage) => ({
      id: stage.ID,
      name: stage.TITLE,
      color: stage.COLOR ? `#${stage.COLOR}` : null,
    }));
}

function detectTaskColumnIndex(dataRows) {
  const sampleRows = dataRows.slice(0, Math.min(10, dataRows.length));
  if (!sampleRows.length) return 0;

  const columnCount = Math.max(...sampleRows.map((row) => row.c?.length ?? 0), 0);
  let bestColumnIndex = 0;
  let bestScore = 0;

  for (let colIndex = 0; colIndex < columnCount; colIndex++) {
    let score = 0;
    sampleRows.forEach((row) => {
      const cell = row?.c?.[colIndex];
      const cellValue = cell?.v ?? cell?.f ?? '';
      if (cellValue && getTaskIdFromUrl(String(cellValue))) score++;
    });
    if (score > bestScore) {
      bestScore = score;
      bestColumnIndex = colIndex;
    }
  }

  return bestColumnIndex;
}

async function parseSheetRows() {
  const sheetUrl = settings.value?.sheetUrl;
  if (!sheetUrl) return [];

  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = sheetUrl.match(/[?&#]gid=(\d+)/);
  if (!idMatch) throw new Error('Не удалось извлечь ID таблицы из ссылки');

  const spreadsheetId = idMatch[1];
  const gid = gidMatch ? gidMatch[1] : '0';

  // Через service worker, а не прямым fetch: контент-скрипт ходит от имени страницы Bitrix, и
  // доступ к docs.google.com ему даёт только CORS-политика Google, а не host_permissions расширения.
  // Query собираем строкой — «tqx=out:json» Google ждёт именно с двоеточием, без процентной кодировки
  // headers=0 отключает автоопределение заголовка самим Google — иначе оно иногда само вырезает
  // первую строку из table.rows ещё до нашего hasHeaders, и rows.slice(1) ниже режет уже настоящие данные
  const fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${gid}&headers=0`;
  const text = await backgroundFetch('GET', fetchUrl, {responseType: 'text', throwOnHttpError: true});

  // Ответ gviz — JSON, завёрнутый в вызов функции: /*O_o*/google.visualization.Query.setResponse({…});
  const jsonText = text.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '');
  const data = JSON.parse(jsonText);

  const rows = data?.table?.rows ?? [];
  const hasHeaders = settings.value?.hasHeaders ?? true;
  const dataRows = hasHeaders ? rows.slice(1) : rows;

  const autoDetect = settings.value?.autoDetectColumn ?? true;
  const taskColumnIndex = autoDetect
    ? detectTaskColumnIndex(dataRows)
    : (settings.value?.taskColumnIndex ?? 1) - 1;

  const result = [];
  dataRows.forEach((row, rowIndex) => {
    const cell = row?.c?.[taskColumnIndex];
    const cellValue = cell?.v ?? cell?.f ?? '';
    if (!cellValue) return;

    const parsed = getTaskIdFromUrl(String(cellValue));
    if (!parsed?.taskId) return;

    result.push({ priority: rowIndex + 1, taskId: parsed.taskId });
  });

  return result;
}

async function fetchTasksData() {
  const taskIds = sheetRows.value.map((row) => row.taskId);
  if (!taskIds.length) {
    enrichedRows.value = [];
    return;
  }

  // Запрашиваем только поля для видимых колонок
  const visibleKeys = visibleColumnKeys.value;
  // Исполнитель нужен всегда, не только для его колонки: по нему фильтр и распределение приоритетов
  const selectFields = ['ID', 'TITLE', 'GROUP_ID', 'STAGE_ID', 'PARENT_ID', 'RESPONSIBLE_ID'];
  if (visibleKeys.includes('createdBy')) selectFields.push('CREATED_BY');
  if (visibleKeys.includes('createdDate')) selectFields.push('CREATED_DATE');
  if (visibleKeys.includes('changedDate')) selectFields.push('CHANGED_DATE');

  isTasksLoading.value = true;
  try {
    const tasksMap = await bitrixApi.getTasksByIdsBatch(taskIds, selectFields);

    const groupIds = [...new Set(Object.values(tasksMap).map((task) => task.groupId).filter(Boolean))];
    const userIds = [
      ...new Set([
        ...Object.values(tasksMap).map((task) => task.responsibleId),
        ...(visibleKeys.includes('createdBy') ? Object.values(tasksMap).map((task) => task.createdBy) : []),
      ].filter(Boolean)),
    ];

    const [stagesData, , usersData] = await Promise.all([
      groupIds.length ? bitrixApi.getStagesBatch(groupIds) : Promise.resolve({}),
      groupIds.length ? bitrixApi.getGroupsByIdsBatch(groupIds) : Promise.resolve({}),
      userIds.length ? bitrixApi.getImUsersBatch(userIds) : Promise.resolve({}),
    ]);

    // До подмены строк: иначе страница успела бы начать загрузку оценок, которую сброс тут же отменит
    resetAiEstimations();
    enrichedRows.value = sheetRows.value.map(({ priority, taskId }) => {
      const task = tasksMap[taskId];
      if (!task) {
        return { priority, taskId, title: null, taskUrl: null, stage: null, stageName: null, responsible: null, createdBy: null, createdDate: null, changedDate: null };
      }

      const stage = stagesData[task.stageId];
      const responsible = usersData[String(task.responsibleId)];
      const creator = visibleKeys.includes('createdBy') ? usersData[String(task.createdBy)] : null;

      return {
        priority,
        taskId,
        taskUrl: getTaskUrl(task.groupId, taskId),
        title: task.title,
        isRootTask: String(task.parentId ?? 0) === '0',
        stage: stage ? { name: stage.TITLE, color: stage.COLOR ? `#${stage.COLOR}` : null } : null,
        stageName: stage?.TITLE ?? null,
        responsible: responsible ? { id: String(responsible.id), name: responsible.name, url: `/company/personal/user/${responsible.id}/`, photo: responsible.avatar || null } : null,
        createdBy: creator ? { name: creator.name, url: `/company/personal/user/${creator.id}/` } : null,
        createdDate: task.createdDate,
        formattedCreatedDate: task.createdDate ? dayjs(task.createdDate).format('DD.MM.YYYY') : null,
        changedDate: task.changedDate,
        formattedChangedDate: task.changedDate ? dayjs(task.changedDate).format('DD.MM.YYYY') : null,
      };
    });

    await restoreMarkedRow();
    dateUpdated.value = `Обновлено: ${dayjs().format('HH:mm:ss')}`;
    cachedAt.value = null;
    loadPageAiEstimations();
  } catch (error) {
    console.warn(error);
    showToast({
      severity: 'error',
      summary: 'Ошибка',
      detail: error.message,
      life: 5000,
    });
  } finally {
    isTasksLoading.value = false;
  }
}

function getAiValues(taskId) {
  return aiValuesByTaskId.value[taskId] ?? staleAiValuesByTaskId.value[taskId] ?? null;
}

function hasAiEstimation(values) {
  return !!values && AI_ESTIMATION_COLUMN_KEYS.some((key) => values[key] != null);
}

// В общей ячейке значения идут подряд, поэтому у часов есть единица, а признак устаревания — словом
function formatAiCellValue(key, value) {
  if (value == null) return '—';
  if (key === 'aiAgentHours' || key === 'aiHumanHours') return `${value} ч`;
  if (key === 'aiOutdated') return value ? 'устарела' : 'актуальна';
  return formatAiEstimationValue(key, value);
}

function getAiCellText(taskId) {
  const values = getAiValues(taskId);
  if (!hasAiEstimation(values)) return '—';
  return selectedAiFields.value.map((field) => formatAiCellValue(field.key, values[field.key])).join(AI_VALUES_SEPARATOR);
}

function getAiCellTooltip(taskId) {
  const values = getAiValues(taskId);
  if (!hasAiEstimation(values)) return 'ИИ-оценки нет';
  return selectedAiFields.value
    .map((field) => `${field.name}: ${formatAiEstimationValue(field.key, values[field.key]) ?? '—'}`)
    .join('\n');
}

function isAiValueLoading(taskId) {
  return !!aiLoadingTaskIds.value[taskId] && !staleAiValuesByTaskId.value[taskId];
}

// Данные задач обновились — прежние оценки остаются на экране, пока страница не догрузит свежие
function resetAiEstimations() {
  aiLoadGeneration++;
  staleAiValuesByTaskId.value = { ...staleAiValuesByTaskId.value, ...aiValuesByTaskId.value };
  aiValuesByTaskId.value = {};
  aiLoadingTaskIds.value = {};
}

async function loadAiEstimationChunk(taskIds, generation) {
  const [tasksMap, commentsByTaskId] = await Promise.all([
    bitrixApi.getTasksByIdsBatch(taskIds, ['ID', 'DESCRIPTION']),
    bitrixApi.getCommentsBatch(taskIds),
  ]);
  if (generation !== aiLoadGeneration) return;

  const loadedValues = {};
  taskIds.forEach((taskId) => {
    const comments = commentsByTaskId[taskId];
    loadedValues[taskId] = getAiEstimationValues(findLatestAiEstimation(tasksMap[taskId]?.description, comments), comments);
  });
  aiValuesByTaskId.value = { ...aiValuesByTaskId.value, ...loadedValues };
}

async function loadPageAiEstimations() {
  // Пока на экране кэш, грузить нечего: следом придут свежие данные задач и запустят загрузку сами
  if (!selectedAiFields.value.length || cachedAt.value) return;

  const missingTaskIds = pageTaskIds.value.filter(
    (taskId) => !aiValuesByTaskId.value[taskId] && !aiLoadingTaskIds.value[taskId],
  );
  if (!missingTaskIds.length) return;

  const generation = aiLoadGeneration;
  aiLoadingTaskIds.value = { ...aiLoadingTaskIds.value, ...Object.fromEntries(missingTaskIds.map((taskId) => [taskId, true])) };

  const queue = chunk(missingTaskIds, AI_CHUNK_SIZE);
  let hasError = false;
  const worker = async () => {
    while (queue.length) {
      const taskIds = queue.shift();
      try {
        await loadAiEstimationChunk(taskIds, generation);
      } catch (error) {
        console.warn(error);
        hasError = true;
      } finally {
        if (generation === aiLoadGeneration) {
          const loadingTaskIds = { ...aiLoadingTaskIds.value };
          taskIds.forEach((taskId) => delete loadingTaskIds[taskId]);
          aiLoadingTaskIds.value = loadingTaskIds;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: AI_CONCURRENCY }, worker));
  if (generation !== aiLoadGeneration) return;

  if (hasError) {
    showToast({
      severity: 'error',
      summary: 'Ошибка загрузки ИИ-оценок',
      detail: 'Не удалось загрузить оценку части задач — она подгрузится при следующем открытии страницы таблицы.',
      life: 5000,
    });
  }
  persistCacheAfterAiLoad();
}

// Кэш пишется целиком — при быстром листании страниц сохраняем один раз, а не после каждой
const persistCacheAfterAiLoad = debounce(persistCache, 2000);
onUnmounted(() => persistCacheAfterAiLoad.cancel());

watch([pageTaskIds, () => selectedAiFields.value.length], loadPageAiEstimations);

async function fetchTeamPoints() {
  if (!settings.value?.showTeamPoints) return;

  const stageIds = settings.value?.teamStages ?? [];
  if (!stageIds.length) return;

  isTeamLoading.value = true;
  try {
    let tasks = await bitrixApi.getAllTasksByStages(stageIds, props.groupId);

    const selectedUserIds = new Set(settings.value?.teamUsers ?? []);
    if (selectedUserIds.size) {
      tasks = tasks.filter((task) => selectedUserIds.has(String(task.responsible?.id)));
    }

    teamTasksRaw.value = tasks;

    const usersMap = {};
    tasks.forEach((task) => {
      const points = getTaskPointsFromName(task.title);
      const { responsible } = task;
      if (!responsible?.id) return;

      if (!usersMap[responsible.id]) {
        usersMap[responsible.id] = {
          id: responsible.id,
          name: responsible.name,
          url: responsible.link,
          photo: responsible.icon || null,
          stages: Object.fromEntries(stageIds.map((id) => [String(id), { points: 0, taskCount: 0 }])),
          totalPoints: 0,
          totalTaskCount: 0,
        };
      }

      const stageKey = String(task.stageId);
      if (stageKey in usersMap[responsible.id].stages) {
        usersMap[responsible.id].stages[stageKey].points += points;
        usersMap[responsible.id].stages[stageKey].taskCount += 1;
      }
      usersMap[responsible.id].totalPoints += points;
      usersMap[responsible.id].totalTaskCount += 1;
    });

    teamRows.value = Object.values(usersMap).sort((a, b) => b.totalPoints - a.totalPoints);
  } catch (error) {
    console.warn(error);
    showToast({
      severity: 'error',
      summary: 'Ошибка загрузки баллов',
      detail: error.message,
      life: 5000,
    });
  } finally {
    isTeamLoading.value = false;
  }
}

async function fetchSheetRows() {
  if (!settings.value?.sheetUrl) return;
  isSheetLoading.value = true;
  try {
    sheetRows.value = await parseSheetRows();
    firstRow.value = 0;
    await fetchTasksData();
  } catch (error) {
    console.warn(error);
    showToast({
      severity: 'error',
      summary: 'Ошибка загрузки таблицы',
      detail: error.message,
      life: 5000,
    });
  } finally {
    isSheetLoading.value = false;
  }
}

async function fetchAll() {
  cachedAt.value = null;
  sheetRows.value = [];
  enrichedRows.value = [];
  teamRows.value = [];
  teamTasksRaw.value = [];
  firstRow.value = 0;
  await Promise.all([fetchGroupMeta(), fetchSheetRows(), fetchTeamPoints()]);
}

function onPageChange(event) {
  firstRow.value = event.first;
  rowsPerPage.value = event.rows;
}

function onTeamCellClick({ user, stage }) {
  selectedTeamUser.value = user;
  selectedTeamStage.value = stage;
  isTeamUserModalOpened.value = true;
}

async function onSaveSettings() {
  isSettingsModalOpened.value = false;
  await loadSettings();
  stageFilter.value = settings.value?.defaultStageFilter ?? [];
  await Promise.all([fetchSheetRows(), fetchTeamPoints()]);
  await persistCache();
}

async function fetchTasksAndTeam() {
  await Promise.all([fetchTasksData(), fetchTeamPoints()]);
}

const refreshActions = [
  { key: 'all', label: 'Обновить всё', icon: 'pi pi-sync', command: fetchAll },
  { key: 'sheet', label: 'Обновить Google Таблицу', icon: 'pi pi-table', command: fetchSheetRows },
  { key: 'tasks', label: 'Обновить данные задач', icon: 'pi pi-list', command: fetchTasksData },
  { key: 'team', label: 'Обновить баллы команды', icon: 'pi pi-chart-bar', command: fetchTeamPoints },
  { key: 'tasksTeam', label: 'Обновить задачи и баллы команды', icon: 'pi pi-refresh', command: fetchTasksAndTeam },
];

const activeRefreshAction = computed(
  () => refreshActions.find((action) => action.key === lastRefreshKey.value) ?? refreshActions[0],
);

const refreshMenuItems = refreshActions.map((action) => ({
  label: action.label,
  icon: action.icon,
  command: () => selectRefreshAction(action),
}));

async function runRefresh(action) {
  await action.command();
  await persistCache();
}

function selectRefreshAction(action) {
  lastRefreshKey.value = action.key;
  chrome.storage.local.set({ [REFRESH_STORAGE_KEY]: action.key });
  runRefresh(action);
}

onMounted(async () => {
  await loadSettings();
  const storedRefresh = await chrome.storage.local.get([REFRESH_STORAGE_KEY]);
  lastRefreshKey.value = storedRefresh[REFRESH_STORAGE_KEY] ?? 'all';
  stageFilter.value = settings.value?.defaultStageFilter ?? [];
  const storedResponsibleFilter = await chrome.storage.local.get(responsibleFilterStorageKey.value);
  responsibleFilter.value = storedResponsibleFilter[responsibleFilterStorageKey.value] ?? [];
  if (settings.value?.sheetUrl) {
    // Сохранённый результат рисуем сразу, свежие данные догружаются следом и заменяют его
    await Promise.all([restoreFromCache(), refreshCacheSize()]);
    await Promise.all([fetchGroupMeta(), fetchSheetRows(), fetchTeamPoints()]);
    await persistCache();
  } else {
    await fetchGroupMeta();
  }
});
</script>

<template>
  <div
    v-if="settings?.sheetUrl"
    class="min-w-[1100px]"
  >
    <div class="flex gap-2 mb-3 items-center flex-wrap">
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
        v-if="cacheSizeBytes > 0"
        v-tooltip="'Виджет запоминает последний показанный результат, чтобы при открытии таблица не стояла пустой. Кнопка удаляет его для этого канбана — на экране всё останется, но следующее открытие снова будет ждать загрузки.'"
        :label="`Сбросить кэш (${cacheSizeLabel})`"
        size="small"
        severity="secondary"
        icon="pi pi-trash"
        variant="text"
        @click="resetCache"
      />
      <SplitButton
        v-tooltip="dateUpdated"
        :label="activeRefreshAction.label"
        :icon="activeRefreshAction.icon"
        :model="refreshMenuItems"
        :loading="isLoading"
        :disabled="isLoading"
        size="small"
        severity="secondary"
        outlined
        @click="runRefresh(activeRefreshAction)"
      />
      <Button
        v-tooltip="'Открыть Google Таблицу'"
        as="a"
        :href="settings.sheetUrl"
        target="_blank"
        rel="noopener"
        icon="pi pi-external-link"
        size="small"
        severity="secondary"
        variant="text"
      />
      <span
        v-if="cachedAt"
        class="text-xs text-surface-500 dark:text-surface-400"
      >
        Сохранённые данные от {{ cachedAtLabel }}{{ isLoading ? ' — обновляем…' : '' }}
      </span>
    </div>

    <TeamPoints
      v-if="settings.showTeamPoints"
      :rows="teamRows"
      :selected-stages="teamSelectedStages"
      :loading="isTeamLoading && !teamRows.length"
      :hide-user-avatar="settings.hideUserAvatar"
      class="mb-4"
      @cell-click="onTeamCellClick"
    />

    <div class="flex gap-2 mb-2 items-center">
      <InputText
        v-model="titleFilter"
        size="small"
        placeholder="Поиск по названию"
        class="w-60"
      />
      <MultiSelect
        v-model="stageFilter"
        :options="stageOptions"
        option-label="name"
        option-value="name"
        filter
        filter-placeholder="Поиск"
        size="small"
        placeholder="Все колонки"
        :max-selected-labels="1"
        class="w-44"
      >
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <span
              v-if="option.color"
              class="inline-block w-2 h-2 rounded-full flex-shrink-0"
              :style="`background-color: ${option.color}`"
            />
            <span>{{ option.name }}</span>
          </div>
        </template>
      </MultiSelect>
      <MultiSelect
        v-model="responsibleFilter"
        :options="responsibleOptions"
        option-label="name"
        option-value="id"
        filter
        filter-placeholder="Поиск"
        size="small"
        placeholder="Все исполнители"
        :max-selected-labels="1"
        selected-items-label="{0} исполнителя"
        class="w-56"
      >
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <Avatar
              v-if="option.photo && !settings.hideUserAvatar"
              :image="option.photo"
              shape="circle"
            />
            <span>{{ option.name }}</span>
          </div>
        </template>
      </MultiSelect>
      <Button
        v-tooltip="'Кому достались задачи из начала списка приоритетов, а кому — из конца. Колонки выбираются в самом окне, исполнители — «Участники» из настроек'"
        label="Распределение приоритетов"
        icon="pi pi-chart-bar"
        size="small"
        severity="secondary"
        variant="text"
        :disabled="!enrichedRows.length"
        @click="isDistributionModalOpened = true"
      />
    </div>

    <DataTable
      ref="tableRef"
      v-model:first="firstRow"
      :value="filteredRows"
      :loading="isLoading && !enrichedRows.length"
      data-key="taskId"
      size="small"
      row-hover
      striped-rows
      removable-sort
      sort-field="priority"
      :sort-order="1"
      :default-sort-order="1"
      paginator
      :rows="rowsPerPage"
      :rows-per-page-options="[10, 25, 50, 100]"
      @page="onPageChange"
    >
      <template #empty>
        <span v-if="isSheetLoading">Загрузка таблицы…</span>
        <span v-else>Нет данных</span>
      </template>

      <Column
        v-if="settings?.showRowMarker !== false"
        style="width: 32px; padding-inline: 4px;"
      >
        <template #body="{ data }">
          <Button
            v-tooltip="'Отметить текущую позицию в списке'"
            :icon="data.taskId === markedRowTaskId ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
            :severity="data.taskId === markedRowTaskId ? 'warn' : 'secondary'"
            size="small"
            variant="text"
            @click="toggleRowMark(data.taskId)"
          />
        </template>
      </Column>

      <Column
        field="priority"
        header="№"
        sortable
        style="width: 60px;"
      />

      <Column
        field="title"
        header="Задача"
        sortable
      >
        <template #body="{ data }">
          <template v-if="data.taskUrl">
            <i
              v-if="data.isRootTask"
              v-tooltip.top="'Корневая задача'"
              class="pi pi-sitemap text-surface-400 dark:text-surface-500 mr-1"
            />
            <a
              class="pts-blur"
              :href="data.taskUrl"
              target="_top"
            >{{ data.title }}</a>
          </template>
          <span
            v-else
            class="text-surface-500 dark:text-surface-400"
          >{{ getInaccessibleTaskTitle(data.taskId) }}</span>
        </template>
      </Column>

      <Column
        field="stageName"
        header="Колонка"
        sortable
        style="white-space: nowrap;"
      >
        <template #body="{ data }">
          <div
            v-if="data.stage"
            class="flex items-center gap-2"
          >
            <span
              v-if="data.stage.color"
              class="inline-block w-2 h-2 rounded-full flex-shrink-0"
              :style="`background-color: ${data.stage.color}`"
            />
            <span>{{ data.stage.name }}</span>
          </div>
          <span v-else>—</span>
        </template>
      </Column>

      <Column
        v-if="visibleColumnKeys.includes('responsible')"
        field="responsible.name"
        header="Исполнитель"
        sortable
        style="white-space: nowrap;"
      >
        <template #body="{ data }">
          <div
            v-if="data.responsible"
            class="flex gap-2 items-center"
          >
            <Avatar
              v-if="data.responsible.photo && !settings.hideUserAvatar"
              :image="data.responsible.photo"
              shape="circle"
            />
            <a
              :href="data.responsible.url"
              target="_top"
            >{{ data.responsible.name }}</a>
          </div>
          <span v-else>—</span>
        </template>
      </Column>

      <Column
        v-if="visibleColumnKeys.includes('createdBy')"
        field="createdBy.name"
        header="Постановщик"
        sortable
        style="white-space: nowrap;"
      >
        <template #body="{ data }">
          <a
            v-if="data.createdBy"
            :href="data.createdBy.url"
            target="_top"
          >{{ data.createdBy.name }}</a>
          <span v-else>—</span>
        </template>
      </Column>

      <Column
        v-if="visibleColumnKeys.includes('createdDate')"
        field="formattedCreatedDate"
        sort-field="createdDate"
        header="Создана"
        sortable
        style="white-space: nowrap;"
      />

      <Column
        v-if="visibleColumnKeys.includes('changedDate')"
        field="formattedChangedDate"
        sort-field="changedDate"
        header="Изменена"
        sortable
        style="white-space: nowrap;"
      />

      <Column
        v-if="selectedAiFields.length"
        header-class="whitespace-nowrap"
        body-class="whitespace-nowrap"
      >
        <template #header>
          <span v-tooltip.top="aiHeaderTooltip">
            <b>ИИ-оценка</b>
            <i class="pi pi-question-circle text-xs text-surface-400 dark:text-surface-500" />
          </span>
        </template>
        <template #body="{ data }">
          <i
            v-if="isAiValueLoading(data.taskId)"
            class="pi pi-spin pi-spinner text-surface-400 dark:text-surface-500"
          />
          <span
            v-else
            v-tooltip.top="getAiCellTooltip(data.taskId)"
          >{{ getAiCellText(data.taskId) }}</span>
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="isSettingsModalOpened"
      header="Настройки"
      dismissable-mask
      modal
    >
      <SettingsForm
        :initial="settings"
        :settings-storage-key
        :all-columns="CONFIGURABLE_COLUMNS"
        :default-hidden-columns="DEFAULT_HIDDEN_COLUMNS"
        :group-users="groupUsers"
        :group-stages="groupStages"
        @success="onSaveSettings"
      />
    </Dialog>

    <Dialog
      v-model:visible="isDistributionModalOpened"
      header="Распределение приоритетов по исполнителям"
      dismissable-mask
      modal
    >
      <PriorityDistribution
        :rows="enrichedRows"
        :stage-options="stageOptions"
        :team-user-ids="settings.teamUsers ?? []"
        :stages-storage-key="`sprint-priorities-distribution-stages-${groupId}`"
        :hide-user-avatar="!!settings.hideUserAvatar"
      />
    </Dialog>

    <Dialog
      v-model:visible="isTeamUserModalOpened"
      :header="selectedTeamUser ? (selectedTeamStage ? `${selectedTeamUser.name} — ${selectedTeamStage.name}` : `Задачи — ${selectedTeamUser.name}`) : ''"
      dismissable-mask
      modal
    >
      <DataTable
        :value="selectedUserStageTasks"
        data-key="id"
        size="small"
        striped-rows
        sort-field="points"
        :sort-order="-1"
        style="min-width: 400px;"
      >
        <Column
          field="title"
          header="Задача"
          sortable
        >
          <template #body="{ data }">
            <i
              v-if="data.isRootTask"
              v-tooltip.top="'Корневая задача'"
              class="pi pi-sitemap text-surface-400 dark:text-surface-500 mr-1"
            />
            <a
              class="pts-blur"
              :href="data.url"
              target="_top"
            >{{ data.title }}</a>
          </template>
        </Column>
        <Column
          field="points"
          header="Баллы"
          sortable
          style="width: 80px;"
        />
        <template #empty>
          Нет задач
        </template>
      </DataTable>
    </Dialog>
  </div>

  <SettingsForm
    v-else
    :initial="settings ?? {}"
    :settings-storage-key
    :all-columns="CONFIGURABLE_COLUMNS"
    :default-hidden-columns="DEFAULT_HIDDEN_COLUMNS"
    :group-users="groupUsers"
    :group-stages="groupStages"
    @success="onSaveSettings"
  />
</template>
