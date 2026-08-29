<script setup>
import dayjs from 'dayjs';
import { Avatar, Badge, Button, Column, DataTable, Message, MultiSelect, Select, SelectButton, Step, StepList, StepPanel, StepPanels, Stepper } from 'primevue';
import { computed, onMounted, ref, toRaw, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { usePersonalGroupFilter } from '../../../composables/usePersonalGroupFilter.js';
import { collectStagesFromGroups, groupStagesByGroup } from '../../../personalPlan.js';
import { showToast } from '../../../toastHost/showToast.js';
import DateRangePicker from '../../../ui/DateRangePicker.vue';
import FormField from '../../../ui/FormField.vue';
import { bbcodeToMarkdown, downloadBlob, escapeCsvCell, getTaskPointsFromName, getTaskUrl, isSystemComment, TASK_STATUS_LABELS } from '../../../utils.js';

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
// Ключ для chrome.storage — обязательно разный неймспейс, иначе фильтры личного плана
// схлопнутся с несуществующей группой с тем же числовым id, что и userId
const contextKey = computed(() => isPersonal.value ? `personal-${props.context.id}` : props.context.id);
// На личном плане ссылки строятся через userId (Bitrix сам так их рендерит для этих карточек)
const linkUserId = computed(() => isPersonal.value ? props.context.id : null);

const bitrixApi = new BitrixApi(props.sessionId);

// В личный план попадают задачи разных групп — фильтр позволяет сузить выгрузку до одной.
// Пусто означает «все группы»
const { groupOptions, selectedGroupId, restoreGroupFilter } = usePersonalGroupFilter(
  bitrixApi,
  `export-group-tasks-group-${props.context.id}`,
);

// Личные предпочтения (набор колонок, формат, разделители) — общие для всех групп.
const SETTINGS_STORAGE_KEY = 'export-group-tasks-settings';
// Фильтры зависят от конкретной группы (свои стадии, свои участники) — хранятся отдельно от настроек.
const filtersStorageKey = computed(() => `export-group-tasks-filters-${contextKey.value}`);

// Предпросмотр — только чтобы проверить набор колонок и формат, не весь список. Реальная
// выгрузка (копирование/скачивание) всегда запрашивает полный список заново по текущим фильтрам.
const PREVIEW_LIMIT = 5;

// value: 'all' — PrimeVue Select считает пустыми значениями null, undefined И '' (ObjectUtils.isEmpty)
// и вместо лейбла подходящего option рендерит пустое поле, поэтому варианту «Все» нужен непустой сентинел.
const STATUS_OPTIONS = [
  { label: 'Все', value: 'all' },
  { label: 'Не завершённые', value: 'active' },
  { label: 'Завершённые', value: 'closed' },
];

const FORMAT_OPTIONS = [
  { label: 'CSV', value: 'csv' },
  { label: 'JSON', value: 'json' },
];

const SEPARATOR_OPTIONS = [
  { label: 'Точка с запятой (;)', value: ';' },
  { label: 'Запятая (,)', value: ',' },
  { label: 'Tab', value: '\t' },
];

const TEXT_FORMAT_OPTIONS = [
  { label: 'BBCode', value: 'bbcode' },
  { label: 'Markdown', value: 'markdown' },
];

// Числовые коды поля PRIORITY — по документации Bitrix24 (REST v3, tasks/rest-v3/fields.html).
const PRIORITY_LABELS = {
  0: 'Низкий',
  1: 'Средний',
  2: 'Высокий',
};

const MARK_LABELS = {
  P: 'Положительная',
  N: 'Отрицательная',
};

// Порядок определяет и порядок столбцов в предпросмотре, и порядок колонок/полей в выгрузке.
const COLUMN_DEFINITIONS = [
  { key: 'id', label: 'ID', default: false },
  { key: 'title', label: 'Название', default: true },
  { key: 'stage', label: 'Стадия', default: false },
  { key: 'status', label: 'Статус', default: false, isStatus: true, selectField: 'STATUS' },
  { key: 'priority', label: 'Приоритет', default: false, isPriority: true, selectField: 'PRIORITY' },
  { key: 'responsible', label: 'Исполнитель', default: false },
  { key: 'creator', label: 'Постановщик', default: false, selectField: 'CREATED_BY' },
  { key: 'createdDate', label: 'Дата создания', default: true, isDate: true },
  { key: 'changedDate', label: 'Дата изменения', default: false, isDate: true },
  { key: 'closedDate', label: 'Дата закрытия', default: false, isDate: true },
  { key: 'deadline', label: 'Крайний срок', default: false, isDate: true, selectField: 'DEADLINE' },
  { key: 'timeEstimate', label: 'Выделенное время', default: false, isDuration: true, selectField: 'TIME_ESTIMATE' },
  { key: 'durationFact', label: 'Затрачено времени (факт)', default: false, isDurationMinutes: true, selectField: 'DURATION_FACT' },
  { key: 'points', label: 'Баллы', default: false },
  { key: 'mark', label: 'Оценка по задаче', default: false, isMark: true, selectField: 'MARK' },
  { key: 'commentsCount', label: 'Число комментариев', default: false },
  { key: 'description', label: 'Описание задачи', default: false, selectField: 'DESCRIPTION' },
  { key: 'comments', label: 'Комментарии', default: false },
  { key: 'url', label: 'Ссылка на задачу', default: true },
];

const activeStep = ref('1');

const selectedColumnKeys = ref(COLUMN_DEFINITIONS.filter((column) => column.default).map((column) => column.key));
const format = ref('csv');
const csvSeparator = ref(',');
const textFormat = ref('bbcode'); // формат описания/комментариев — BBCode как есть или конвертация в Markdown

const dateRange = ref(null); // не персистится — сессионный, в отличие от остальных фильтров
const status = ref('active');
const stageIds = ref([]);
const responsibleId = ref(null);
const createdById = ref(null);

const isLoading = ref(false);
const isExporting = ref(false);
const isStagesLoading = ref(false);
const isGroupUsersLoading = ref(false);
const previewTasks = ref([]);
const stages = ref([]);
const groupUsers = ref([]);
const creatorNameById = ref({});

let isInitializing = true;

const visibleColumns = computed(() => COLUMN_DEFINITIONS.filter((column) => selectedColumnKeys.value.includes(column.key)));
const stageMap = computed(() => Object.fromEntries(stages.value.map((stage) => [stage.id, stage])));

// Колонки из нескольких канбанов разводим группами PrimeVue, а не подписью в каждой опции —
// с заголовком группы над списком подпись у каждой строки была бы лишней. Одна группа — плоский
// список без заголовка
const stageGroups = computed(() => groupStagesByGroup(stages.value));
const hasSeveralStageGroups = computed(() => stageGroups.value.length > 1);
const stageSelectOptions = computed(() => (hasSeveralStageGroups.value ? stageGroups.value : stages.value));
const showRichTextFormat = computed(() => selectedColumnKeys.value.includes('description') || selectedColumnKeys.value.includes('comments'));

// Список участников только этой группы (не все возможные исполнители/постановщики в системе) —
// используется для фильтров «Исполнитель»/«Постановщик».
const userOptions = computed(() => groupUsers.value.map((user) => ({
  id: Number(user.ID),
  name: [user.NAME, user.LAST_NAME].filter(Boolean).join(' '),
  avatar: user.PERSONAL_PHOTO ?? '',
})));

function formatRichText(text) {
  if (!text) return '';
  return textFormat.value === 'markdown' ? bbcodeToMarkdown(text) : text;
}

function formatCommentsBlock(userComments) {
  if (!userComments?.length) return '';
  return userComments.map((comment, index) => {
    const author = [comment.AUTHOR_NAME, comment.AUTHOR_LAST_NAME].filter(Boolean).join(' ') || '?';
    const date = comment.POST_DATE ? dayjs(comment.POST_DATE).format('DD.MM.YY') : '';
    const text = formatRichText(comment.POST_MESSAGE || '');
    return `[${index + 1}] ${author}${date ? ` (${date})` : ''}:\n${text}`;
  }).join('\n\n');
}

function enrichTask(task) {
  const creatorId = String(task.createdBy?.id ?? task.createdBy ?? '');
  // COMMENTS_COUNT из Bitrix считает и системные авто-сообщения — Число комментариев
  // должно отражать реально экспортируемые (пользовательские) комментарии, поэтому считаем
  // от уже загруженного и отфильтрованного списка, а не от сырого поля задачи.
  const userComments = task.comments?.filter((comment) => !isSystemComment(comment)) ?? null;
  return {
    id: task.id,
    title: task.title,
    isRootTask: String(task.parentId ?? 0) === '0',
    groupId: task.groupId,
    stage: stageMap.value[String(task.stageId)]?.name ?? '',
    stageColor: stageMap.value[String(task.stageId)]?.color ?? null,
    status: task.status ?? null,
    priority: task.priority ?? null,
    responsible: task.responsible?.name ?? '',
    creator: task.createdBy?.name ?? creatorNameById.value[creatorId] ?? '',
    createdDate: task.createdDate ?? null,
    changedDate: task.changedDate ?? null,
    closedDate: task.closedDate ?? null,
    deadline: task.deadline ?? null,
    timeEstimate: task.timeEstimate ?? null,
    durationFact: task.durationFact ?? null,
    points: getTaskPointsFromName(task.title),
    mark: task.mark ?? null,
    commentsCount: task.comments ? userComments.length : null,
    description: formatRichText(task.description ?? ''),
    comments: formatCommentsBlock(userComments),
    url: getTaskUrl(isPersonal.value ? null : task.groupId, task.id, linkUserId.value),
  };
}

const enrichedPreviewTasks = computed(() => previewTasks.value.map(enrichTask));

// Предпросмотр грузится по тем же фильтрам, что и сама выгрузка (просто с limit) — значит пустой
// предпросмотр означает пустой результат, и по нему же решаем, есть ли что выгружать
const hasTasksToExport = computed(() => enrichedPreviewTasks.value.length > 0);

watch([selectedColumnKeys, format, csvSeparator, textFormat], () => {
  if (isInitializing) return;
  chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: {
      columns: toRaw(selectedColumnKeys.value),
      format: format.value,
      csvSeparator: csvSeparator.value,
      textFormat: textFormat.value,
    },
  });
}, { deep: true });

// Колонки прошлой группы к новой отношения не имеют: и список перезагружаем, и выбор сбрасываем,
// иначе оставшийся id отфильтровал бы выдачу в ноль
watch(selectedGroupId, async () => {
  if (isInitializing) return;
  stageIds.value = [];
  // Чужие группы прошлой выдачи к новому фильтру отношения не имеют
  extraStageGroupIds.value = [];
  await loadPersonalStages();
});

watch([status, stageIds, responsibleId, createdById], () => {
  if (isInitializing) return;
  chrome.storage.local.set({
    [filtersStorageKey.value]: {
      status: status.value,
      stageIds: toRaw(stageIds.value),
      responsibleId: responsibleId.value,
      createdById: createdById.value,
    },
  });
}, { deep: true });

// Поля, которые нужны только конкретным (необязательным) колонкам, запрашиваются через extraSelectFields —
// а не в общем select[] — чтобы не тянуть их для всех задач, если колонка не выбрана. Если такую колонку
// включили уже на шаге предпросмотра, previewTasks нужно перезапросить — иначе в уже загруженных задачах
// этого поля просто не будет.
const requiredExtraSelectFields = computed(() => (
  COLUMN_DEFINITIONS.filter((column) => column.selectField && selectedColumnKeys.value.includes(column.key))
    .map((column) => column.selectField)
));
// «Комментарии» и «Число комментариев» не приходят вместе с остальными полями задачи (не через
// select[]/extraSelectFields), а догружаются отдельным batch-запросом — поэтому отслеживаются
// отдельным флагом, а не через requiredExtraSelectFields.
const needsComments = computed(() => (
  selectedColumnKeys.value.includes('comments') || selectedColumnKeys.value.includes('commentsCount')
));
let lastFetchedExtraSelectFields = [];
let lastFetchedNeedsComments = false;

watch([requiredExtraSelectFields, needsComments], ([fields, needsCommentsNow]) => {
  if (isInitializing || !previewTasks.value.length) return;
  const isMissingField = fields.some((field) => !lastFetchedExtraSelectFields.includes(field));
  const isMissingComments = needsCommentsNow && !lastFetchedNeedsComments;
  if (isMissingField || isMissingComments) loadPreview();
});

// Постановщик резолвится лениво отдельным batch-запросом, только когда включена соответствующая
// колонка — большинству экспортов эти данные не нужны, а resolve одного созданного пользователя
// на каждую задачу был бы лишним раунд-трипом по умолчанию.
async function loadCreatorNames(tasks) {
  const unresolvedIds = [...new Set(
    tasks
      .filter((task) => !task.createdBy?.name)
      .map((task) => String(task.createdBy?.id ?? task.createdBy ?? ''))
      .filter((id) => id && !creatorNameById.value[id]),
  )];
  if (!unresolvedIds.length) return;

  try {
    const users = await bitrixApi.getImUsersBatch(unresolvedIds);
    const nextMap = { ...creatorNameById.value };
    Object.entries(users).forEach(([id, user]) => {
      nextMap[id] = user.name || [user.first_name, user.last_name].filter(Boolean).join(' ');
    });
    creatorNameById.value = nextMap;
  } catch (e) {
    console.warn('[export-group-tasks] failed to resolve creators:', e);
  }
}

async function loadStages() {
  // На личном плане своего набора колонок нет: STAGE_ID задачи указывает на канбан её собственной
  // группы. Список собирается из уже выгруженных задач (см. refreshPersonalStages), поэтому до
  // первой выгрузки колонок ещё нет
  if (isPersonal.value) return;

  isStagesLoading.value = true;
  try {
    const stagesResponse = await bitrixApi.getStages(props.context.id);
    stages.value = Object.values(stagesResponse.data?.result ?? {})
      .sort((a, b) => a.SORT - b.SORT)
      .map((stage) => ({ id: String(stage.ID), title: stage.TITLE, name: stage.TITLE, color: `#${stage.COLOR}` }));
  } catch (e) {
    console.warn('[export-group-tasks] failed to load stages:', e);
  } finally {
    isStagesLoading.value = false;
  }
}

async function loadGroupUsers() {
  // На личном плане участников группы нет — исполнитель/постановщик всегда один и тот же человек
  if (isPersonal.value) return;

  isGroupUsersLoading.value = true;
  try {
    groupUsers.value = await bitrixApi.getGroupUsers(props.context.id);
  } catch (e) {
    console.warn('[export-group-tasks] failed to load group users:', e);
  } finally {
    isGroupUsersLoading.value = false;
  }
}

// На личном плане «мои задачи» — это объединение 4 ролей (ответственный/соисполнитель/наблюдатель/
// постановщик), а не только ответственность — см. searchMyTasks() в BitrixApi.js
async function runSearch(params) {
  if (!isPersonal.value) return bitrixApi.searchTasks(params);

  const tasks = await bitrixApi.searchMyTasks(props.context.id, {...params, groupId: selectedGroupId.value});
  await addUnknownStages(tasks);
  return tasks;
}

// Группы, чьих канбанов нет в составе участия пользователя. В личный план попадает и задача такой
// группы (добавили наблюдателем), и без её колонок столбец «Стадия» показал бы прочерк
const extraStageGroupIds = ref([]);

// Колонки для фильтра нужны уже на первом шаге, до всякой выгрузки, поэтому берутся не из задач,
// а из канбанов групп пользователя — это один батч. Выбрана конкретная группа — только её колонки,
// иначе колонки всех групп сразу
async function loadPersonalStages() {
  const baseGroupIds = selectedGroupId.value
    ? [selectedGroupId.value]
    : groupOptions.value.map((group) => group.id);
  const groupIds = [...new Set([...baseGroupIds, ...extraStageGroupIds.value])];

  isStagesLoading.value = true;
  try {
    stages.value = await collectStagesFromGroups(bitrixApi, groupIds);
  } catch (error) {
    console.warn('[export-group-tasks] failed to load stages:', error);
    stages.value = [];
  } finally {
    isStagesLoading.value = false;
  }
}

// Список пересобирается целиком, а не дополняется: подпись группы у колонки зависит от того,
// сколько групп в списке, и дописанные колонки разошлись бы с уже собранными по оформлению
async function addUnknownStages(tasks) {
  const knownStageIds = new Set(stages.value.map((stage) => stage.id));
  const unknownGroupIds = new Set();
  tasks.forEach((task) => {
    const stageId = String(task.stageId ?? '');
    const groupId = String(task.groupId ?? '0');
    if (!stageId || stageId === '0' || groupId === '0') return;
    if (!knownStageIds.has(stageId)) unknownGroupIds.add(groupId);
  });

  const newGroupIds = [...unknownGroupIds].filter((groupId) => !extraStageGroupIds.value.includes(groupId));
  if (!newGroupIds.length) return;

  extraStageGroupIds.value = [...extraStageGroupIds.value, ...newGroupIds];
  await loadPersonalStages();
}

function buildFilterParams() {
  return {
    groupId: isPersonal.value ? null : props.context.id,
    responsibleId: isPersonal.value ? null : responsibleId.value,
    status: status.value === 'all' ? null : status.value,
    stageIds: stageIds.value,
    createdBy: isPersonal.value ? null : createdById.value,
    createdDateFrom: dateRange.value?.[0] ? dayjs(dateRange.value[0]).format('YYYY-MM-DD 00:00:00') : null,
    createdDateTo: dateRange.value?.[1] ? dayjs(dateRange.value[1] ?? dateRange.value[0]).format('YYYY-MM-DD 23:59:59') : null,
    // По умолчанию свежие задачи должны идти первее — сортировка нужна на сервере, а не после
    // получения данных: иначе «первые N» в предпросмотре были бы просто первыми по ID, не самыми новыми.
    order: { field: 'CREATED_DATE', direction: 'DESC' },
    extraSelectFields: requiredExtraSelectFields.value,
  };
}

// Комментарии не приходят вместе с остальными полями задачи — догружаются отдельным batch-запросом,
// только когда включена колонка «Комментарии» или «Число комментариев» (счётчик считается от
// реально загруженных комментариев, а не от сырого поля задачи — см. enrichTask).
async function attachComments(tasks) {
  if (!needsComments.value || !tasks.length) return tasks;
  const commentsByTaskId = await bitrixApi.getCommentsBatch(tasks.map((task) => task.id));
  return tasks.map((task) => ({ ...task, comments: commentsByTaskId[task.id] ?? [] }));
}

async function loadPreview() {
  isLoading.value = true;
  try {
    const extraSelectFields = requiredExtraSelectFields.value;
    const needsCommentsNow = needsComments.value;
    let tasks = await runSearch({ ...buildFilterParams(), limit: PREVIEW_LIMIT });
    tasks = await attachComments(tasks);
    previewTasks.value = tasks;
    lastFetchedExtraSelectFields = extraSelectFields;
    lastFetchedNeedsComments = needsCommentsNow;

    if (selectedColumnKeys.value.includes('creator')) await loadCreatorNames(tasks);
    return true;
  } catch (e) {
    console.warn('[export-group-tasks]', e);
    showToast({
      severity: 'error',
      summary: 'Ошибка загрузки задач',
      detail: e.message,
      life: 5000,
    });
    return false;
  } finally {
    isLoading.value = false;
  }
}

async function goToStep2(activateCallback) {
  const success = await loadPreview();
  if (success) activateCallback('2');
}

// Реальная выгрузка не переиспользует previewTasks (он ограничен PREVIEW_LIMIT) — запрашивает
// полный список заново по текущим фильтрам в момент копирования/скачивания.
async function getExportTasks() {
  let tasks = await runSearch(buildFilterParams());
  tasks = await attachComments(tasks);
  if (selectedColumnKeys.value.includes('creator')) await loadCreatorNames(tasks);
  return tasks;
}

onMounted(async () => {
  try {
    if (isPersonal.value) {
      await restoreGroupFilter();
      await loadPersonalStages();
    }

    const stored = await chrome.storage.local.get([SETTINGS_STORAGE_KEY, filtersStorageKey.value]);
    const settings = stored[SETTINGS_STORAGE_KEY];
    if (settings) {
      // Array.isArray() на случай старых записей, испорченных прежним багом с сохранением reactive-массива без toRaw()
      selectedColumnKeys.value = Array.isArray(settings.columns) ? settings.columns : selectedColumnKeys.value;
      format.value = settings.format ?? 'csv';
      csvSeparator.value = settings.csvSeparator ?? ',';
      textFormat.value = settings.textFormat ?? 'bbcode';
    }

    const filters = stored[filtersStorageKey.value];
    if (filters) {
      status.value = filters.status ?? 'active';
      stageIds.value = Array.isArray(filters.stageIds) ? filters.stageIds : [];
      responsibleId.value = filters.responsibleId ?? null;
      createdById.value = filters.createdById ?? null;
    }
  } finally {
    isInitializing = false;
  }

  loadStages();
  loadGroupUsers();
});

function formatDate(dateStr) {
  return dateStr ? dayjs(dateStr).format('DD.MM.YYYY') : '';
}

// TIME_ESTIMATE хранится в секундах (как и большинство полей времени в задачах Bitrix24,
// например TIME_SPENT_IN_LOGS) — в документации явно не указано, но подтверждается тем,
// что поле заполняется через ввод «часы:минуты» в форме задачи.
function formatTimeEstimate(totalSeconds) {
  if (!totalSeconds) return '';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return [hours && `${hours} ч`, minutes && `${minutes} мин`].filter(Boolean).join(' ') || '0 мин';
}

// CSS line-clamp на длинном BBCode/Markdown тексте в таблице предпросмотра ощутимо лагает —
// обрезаем строку сразу в JS, чтобы в DOM попадала только короткая однострочная версия.
const PREVIEW_TEXT_MAX_LENGTH = 50;

function truncateForPreview(text) {
  if (!text) return '';
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > PREVIEW_TEXT_MAX_LENGTH ? `${singleLine.slice(0, PREVIEW_TEXT_MAX_LENGTH)}…` : singleLine;
}

function displayValue(task, column) {
  if (column.isDate) return formatDate(task[column.key]);
  if (column.isDuration) return formatTimeEstimate(task[column.key]);
  if (column.isDurationMinutes) return formatTimeEstimate(task[column.key] != null ? task[column.key] * 60 : null);
  if (column.isStatus) return TASK_STATUS_LABELS[task[column.key]] ?? '';
  if (column.isPriority) return PRIORITY_LABELS[task[column.key]] ?? '';
  if (column.isMark) return MARK_LABELS[task[column.key]] ?? '';
  return task[column.key] ?? '';
}

function buildCsv(tasks) {
  const headers = visibleColumns.value.map((column) => column.label);
  const dataRows = tasks.map((task) => visibleColumns.value.map((column) => displayValue(task, column)));
  return [headers, ...dataRows]
    .map((row) => row.map(escapeCsvCell).join(csvSeparator.value))
    .join('\n');
}

function buildJson(tasks) {
  const rows = tasks.map((task) =>
    Object.fromEntries(visibleColumns.value.map((column) => [column.key, displayValue(task, column)])),
  );
  return JSON.stringify(rows, null, 2);
}

function buildOutput(tasks) {
  return format.value === 'json' ? buildJson(tasks) : buildCsv(tasks);
}

async function copyToClipboard() {
  isExporting.value = true;
  try {
    const tasks = (await getExportTasks()).map(enrichTask);
    await navigator.clipboard.writeText(buildOutput(tasks));
    showToast({ severity: 'success', summary: 'Скопировано!', life: 2000 });
  } catch (e) {
    console.warn('[export-group-tasks]', e);
    showToast({ severity: 'error', summary: 'Ошибка копирования', life: 3000 });
  } finally {
    isExporting.value = false;
  }
}

async function downloadFile() {
  isExporting.value = true;
  try {
    const tasks = (await getExportTasks()).map(enrichTask);
    const mimeType = format.value === 'json' ? 'application/json' : 'text/csv';
    const blob = new Blob([buildOutput(tasks)], { type: `${mimeType};charset=utf-8` });
    downloadBlob(blob, isPersonal.value ? `tasks-my-plan.${format.value}` : `tasks-group-${props.context.id}.${format.value}`);
  } catch (e) {
    console.warn('[export-group-tasks]', e);
    showToast({
      severity: 'error',
      summary: 'Ошибка выгрузки',
      detail: e.message,
      life: 5000,
    });
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <Stepper
    v-model:value="activeStep"
    linear
  >
    <StepList>
      <Step value="1">
        Фильтры
      </Step>
      <Step value="2">
        Колонки и формат
      </Step>
    </StepList>
    <StepPanels>
      <StepPanel
        v-slot="{ activateCallback }"
        value="1"
      >
        <div class="flex flex-col gap-4 pt-4">
          <div class="grid grid-cols-3 gap-3">
            <FormField label="Дата создания">
              <DateRangePicker v-model="dateRange" />
            </FormField>
            <FormField label="Статус">
              <Select
                v-model="status"
                :options="STATUS_OPTIONS"
                option-label="label"
                option-value="value"
                size="small"
                class="w-full"
              />
            </FormField>
            <FormField
              v-if="isPersonal"
              label="Группа"
              tip="В личный план попадают задачи разных групп. Пусто — выгружаем по всем"
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
              label="Колонка канбана"
              :tip="isPersonal ? 'Колонки всех ваших групп, разбитые по группам. Выберите группу выше, чтобы оставить только её колонки' : ''"
            >
              <MultiSelect
                v-model="stageIds"
                :options="stageSelectOptions"
                option-label="title"
                option-value="id"
                :option-group-label="hasSeveralStageGroups ? 'groupName' : undefined"
                :option-group-children="hasSeveralStageGroups ? 'stages' : undefined"
                placeholder="Все"
                filter
                :filter-fields="['title', 'groupName']"
                filter-placeholder="Поиск"
                :max-selected-labels="2"
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
            <FormField
              v-if="!isPersonal"
              label="Исполнитель"
              tip="Список ограничен участниками этой группы — не все возможные исполнители задач в системе"
            >
              <Select
                v-model="responsibleId"
                :options="userOptions"
                option-label="name"
                option-value="id"
                placeholder="Любой"
                show-clear
                :loading="isGroupUsersLoading"
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
              v-if="!isPersonal"
              label="Постановщик"
              tip="Список ограничен участниками этой группы — не все возможные постановщики задач в системе"
            >
              <Select
                v-model="createdById"
                :options="userOptions"
                option-label="name"
                option-value="id"
                placeholder="Любой"
                show-clear
                :loading="isGroupUsersLoading"
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
          </div>

          <Button
            label="Далее"
            icon="pi pi-arrow-right"
            icon-pos="right"
            :loading="isLoading"
            size="small"
            class="self-start"
            @click="goToStep2(activateCallback)"
          />
        </div>
      </StepPanel>

      <StepPanel
        v-slot="{ activateCallback }"
        value="2"
      >
        <div class="flex flex-col gap-4 pt-4">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            severity="secondary"
            variant="text"
            size="small"
            class="self-start"
            @click="activateCallback('1')"
          />

          <FormField label="Колонки экспорта">
            <MultiSelect
              v-model="selectedColumnKeys"
              :options="COLUMN_DEFINITIONS"
              option-label="label"
              option-value="key"
              placeholder="Выберите колонки"
              filter
              filter-placeholder="Поиск"
              :max-selected-labels="3"
              size="small"
              class="w-full"
            />
          </FormField>

          <div
            v-if="showRichTextFormat"
            class="flex flex-col gap-2"
          >
            <FormField label="Формат текста (описание, комментарии)">
              <SelectButton
                v-model="textFormat"
                :options="TEXT_FORMAT_OPTIONS"
                option-label="label"
                option-value="value"
                :allow-empty="false"
                size="small"
              />
            </FormField>
            <Message
              severity="warn"
              size="small"
              variant="simple"
            >
              Загрузка описаний и комментариев может занять больше времени — они запрашиваются отдельно от остальных данных
            </Message>
          </div>

          <div>
            <div class="text-xs text-surface-400 dark:text-surface-500 mb-2">
              Предпросмотр по первым {{ PREVIEW_LIMIT }} задачам — при экспорте выгрузятся все, подходящие под фильтры
            </div>
            <DataTable
              :value="enrichedPreviewTasks"
              :loading="isLoading"
              data-key="id"
              size="small"
              striped-rows
              table-class="min-w-max"
            >
              <Column
                v-for="column in visibleColumns"
                :key="column.key"
                :field="column.key"
                :header="column.label"
                header-class="whitespace-nowrap"
                body-class="whitespace-nowrap"
              >
                <template #body="{ data }">
                  <template v-if="column.key === 'title'">
                    <i
                      v-if="data.isRootTask"
                      v-tooltip.top="'Корневая задача'"
                      class="pi pi-sitemap text-surface-400 dark:text-surface-500 mr-1"
                    />
                    <a
                      class="pts-blur"
                      :href="getTaskUrl(isPersonal ? null : data.groupId, data.id, linkUserId)"
                      target="_top"
                    >
                      {{ data.title }}
                    </a>
                  </template>
                  <div
                    v-else-if="column.key === 'stage'"
                    class="flex gap-2 items-center"
                  >
                    <Badge
                      v-if="data.stageColor"
                      :style="`background-color: ${data.stageColor};`"
                    />
                    {{ data.stage || '—' }}
                  </div>
                  <a
                    v-else-if="column.key === 'url'"
                    :href="data.url"
                    target="_top"
                  >{{ data.url }}</a>
                  <span
                    v-else-if="column.key === 'description' || column.key === 'comments'"
                    class="pts-blur text-xs"
                  >
                    {{ truncateForPreview(data[column.key]) || '—' }}
                  </span>
                  <template v-else-if="column.isDate">
                    {{ formatDate(data[column.key]) || '—' }}
                  </template>
                  <template v-else-if="column.isDuration">
                    {{ formatTimeEstimate(data[column.key]) || '—' }}
                  </template>
                  <template v-else-if="column.isDurationMinutes">
                    {{ formatTimeEstimate(data[column.key] != null ? data[column.key] * 60 : null) || '—' }}
                  </template>
                  <template v-else-if="column.isStatus">
                    {{ TASK_STATUS_LABELS[data.status] || '—' }}
                  </template>
                  <template v-else-if="column.isPriority">
                    {{ PRIORITY_LABELS[data.priority] || '—' }}
                  </template>
                  <template v-else-if="column.isMark">
                    {{ MARK_LABELS[data.mark] || '—' }}
                  </template>
                  <template v-else>
                    {{ data[column.key] || '—' }}
                  </template>
                </template>
              </Column>

              <template #empty>
                Задачи не найдены
              </template>
            </DataTable>
          </div>

          <div class="flex gap-2 flex-wrap items-center border-t border-surface-200 dark:border-surface-700 pt-3">
            <FormField label="Формат">
              <SelectButton
                v-model="format"
                :options="FORMAT_OPTIONS"
                option-label="label"
                option-value="value"
                :allow-empty="false"
                size="small"
              />
            </FormField>
            <FormField
              v-if="format === 'csv'"
              label="Разделитель CSV"
            >
              <Select
                v-model="csvSeparator"
                :options="SEPARATOR_OPTIONS"
                option-label="label"
                option-value="value"
                size="small"
                class="w-44"
              />
            </FormField>
            <Button
              label="Скопировать"
              icon="pi pi-copy"
              size="small"
              :loading="isExporting"
              :disabled="!hasTasksToExport || !visibleColumns.length"
              class="ml-auto"
              @click="copyToClipboard"
            />
            <Button
              :label="`Скачать .${format}`"
              icon="pi pi-download"
              severity="secondary"
              size="small"
              :loading="isExporting"
              :disabled="!hasTasksToExport || !visibleColumns.length"
              @click="downloadFile"
            />
          </div>
        </div>
      </StepPanel>
    </StepPanels>
  </Stepper>
</template>
