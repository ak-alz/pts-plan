<script setup>
import dayjs from 'dayjs';
import { Button, Dialog, IconField, InputIcon, InputText, SelectButton, Skeleton, Textarea, ToggleSwitch } from 'primevue';
import { computed, onMounted, ref, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { DISK_FILE_INLINE_RE } from '../../../patterns.js';
import { showToast } from '../../../toastHost/showToast.js';
import { translateRuToEn } from '../../../translateRuToEn.js';
import FormField from '../../../ui/FormField.vue';
import { bbcodeToMarkdown, downloadBlob, estimateImageTokenCount, estimateTokenCount, isImageFileName, isSystemComment, minifyPrompt, pluralize, slugify, TASK_STATUS_LABELS } from '../../../utils.js';
import { ARCHIVE_NAME_SLUG_PLACEHOLDER, DEFAULT_ARCHIVE_NAME_TEMPLATE, getTaskTitleText, renderArchiveName, withZipExtension } from '../variables.js';
import SettingsForm from './SettingsForm.vue';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  taskId: {
    type: String,
    required: true,
  },
});

const api = new BitrixApi(props.sessionId);

const loading = ref(true);
const loadingComments = ref(false);
const commentsLoaded = ref(false);
const loadingSubtasks = ref(false);
const subtasksLoaded = ref(false);
const subtasksTree = ref([]); // дерево прямых подзадач taskId: [{ id, title, status, files: [{name, url}], children: [...] }]
const loadingParentTasks = ref(false);
const parentTasksLoaded = ref(false);
const parentTasks = ref([]); // цепочка предков от корневой задачи к прямому родителю: [{ id, title, description, createdDate, status, files: [{name, url, diskFileId}] }]
const taskTitle = ref('');
const taskDescription = ref('');
const taskCreatedDate = ref('');
const taskStatus = ref('');
const taskStageName = ref('');
const taskAuthorId = ref('');
const taskParentId = ref('');
const taskAuthorName = ref('');
const taskFileObjects = ref([]);
const allComments = ref([]);
const groupId = ref('');

const includeExtraContext = ref(false);
const extraContext = ref('');
const includeTitle = ref(true);
const includeDescription = ref(true);
const includeComments = ref(true);
const includeSubtasks = ref(false);
const includeParentTasks = ref(false);
const textFormat = ref('bbcode'); // формат самого текста (описание/комментарии) — независим от exportAsJson
const exportAsJson = ref(false); // оборачивает результат в JSON-структуру вместо плоского текста
const downloadingZip = ref(false);
const archiveNameTemplate = ref(DEFAULT_ARCHIVE_NAME_TEMPLATE);
const archiveName = ref('');
const showArchiveNameInput = ref(false);
const autoCountImageTokens = ref(false);
const translatingSlug = ref(false);
const isSettingsOpened = ref(false);
const attachmentDiskIdMap = ref(new Map()); // ATTACHMENT_ID → "n{OBJECT_ID}"
const diskFileByObjectId = ref(new Map()); // "n{OBJECT_ID}" → { name, url } — все известные файлы Диска (вложения + инлайн-изображения в тексте)
const imageSizeByUrl = ref(new Map()); // url изображения → { width, height } либо null, если размеры получить не удалось
const measuringImages = ref(false);
const imagesMeasured = ref(false);

const textFormatOptions = [
  { label: 'BBCode', value: 'bbcode' },
  { label: 'Markdown', value: 'markdown' },
];

const SETTINGS_STORAGE_KEY = 'export-task-settings';
// Предел глубины обхода дерева подзадач: реальные деревья куда мельче, а каждый уровень — это ещё
// один последовательный запрос
const MAX_SUBTASK_DEPTH = 20;
// Тот же предел для подъёма по цепочке предков: от циклов защищает visitedIds, а это страховка
// от неправдоподобно длинной цепочки — каждый уровень стоит отдельного запроса
const MAX_PARENT_DEPTH = 20;
const extraContextStorageKey = computed(() => `export-task-context-${groupId.value}`);

let isInitializing = true;
let authorLoaded = false;
let translatedTaskSlug = null;

watch([includeTitle, includeDescription, includeComments, includeSubtasks, includeParentTasks, textFormat, exportAsJson, archiveNameTemplate, showArchiveNameInput, autoCountImageTokens], () => {
  if (isInitializing) return;
  chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: {
      includeTitle: includeTitle.value,
      includeDescription: includeDescription.value,
      includeComments: includeComments.value,
      includeSubtasks: includeSubtasks.value,
      includeParentTasks: includeParentTasks.value,
      textFormat: textFormat.value,
      exportAsJson: exportAsJson.value,
      archiveNameTemplate: archiveNameTemplate.value,
      showArchiveNameInput: showArchiveNameInput.value,
      autoCountImageTokens: autoCountImageTokens.value,
    },
  });
});

watch(includeComments, async (newValue) => {
  if (isInitializing) return;
  if (newValue && !commentsLoaded.value) {
    await loadComments();
  }
});

watch(includeSubtasks, async (newValue) => {
  if (isInitializing) return;
  if (newValue && !subtasksLoaded.value) {
    await loadSubtasks();
  }
});

watch(includeParentTasks, async (newValue) => {
  if (isInitializing) return;
  if (newValue && !parentTasksLoaded.value) {
    await loadParentTasks();
  }
});

// Имя автора задачи (постановщика) нужно только для JSON, поэтому подгружается лениво
// отдельным запросом, а не всегда вместе с самой задачей.
watch(exportAsJson, (isJson) => {
  if (isJson) loadTaskAuthor();
});

async function loadTaskAuthor() {
  if (authorLoaded || !taskAuthorId.value) return;
  authorLoaded = true;
  try {
    const users = await api.getImUsersBatch([taskAuthorId.value]);
    const user = users[taskAuthorId.value];
    taskAuthorName.value = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  } catch {
    authorLoaded = false;
  }
}

async function onExtraContextInput(event) {
  extraContext.value = event.target.value;
  await chrome.storage.local.set({ [extraContextStorageKey.value]: extraContext.value });
}

const userComments = computed(() =>
  allComments.value.filter((comment) => !isSystemComment(comment)),
);

const selectedComments = computed(() => includeComments.value ? userComments.value : []);

function countSubtasks(nodes) {
  return nodes.reduce((total, node) => total + 1 + countSubtasks(node.children), 0);
}

const subtasksCount = computed(() => countSubtasks(subtasksTree.value));

function attachmentFileName(attachmentId, originalName) {
  const extension = originalName?.split('.').pop()?.toLowerCase() || 'bin';
  const diskFileId = attachmentDiskIdMap.value.get(String(attachmentId)) ?? attachmentId;
  return `${diskFileId}.${extension}`;
}

// Единая точка регистрации ATTACHMENT_ID → n{OBJECT_ID} — вызывается и для вложений задачи,
// и для вложений комментариев, чтобы итоговые имена файлов были в одном формате.
function registerDiskIds(attachedObjects) {
  attachedObjects.forEach((attachedObject) => {
    if (!attachedObject?.ID || !attachedObject?.OBJECT_ID) return;
    const diskFileId = `n${attachedObject.OBJECT_ID}`;
    attachmentDiskIdMap.value.set(String(attachedObject.ID), diskFileId);
    if (attachedObject.DOWNLOAD_URL) {
      diskFileByObjectId.value.set(diskFileId, {
        name: attachmentFileName(attachedObject.ID, attachedObject.NAME),
        url: attachedObject.DOWNLOAD_URL,
      });
    }
  });
}

function extractInlineDiskFileIds(text) {
  return new Set([...(text || '').matchAll(DISK_FILE_INLINE_RE)].map(([, objectId]) => `n${objectId}`));
}

// Подтягивает файлы Диска, вставленные прямо в текст (не через список вложений). Пропускает
// ID, уже известные через registerDiskIds, чтобы не скачивать один и тот же файл дважды.
async function resolveInlineDiskFiles(diskFileIds) {
  const unresolvedIds = [...diskFileIds].filter((diskFileId) => !diskFileByObjectId.value.has(diskFileId));
  if (!unresolvedIds.length) return;

  const diskFiles = await api.getDiskFilesBatch(unresolvedIds.map((diskFileId) => diskFileId.slice(1))).catch(() => []);
  diskFiles.forEach((file) => {
    if (!file?.ID || !file?.DOWNLOAD_URL) return;
    const extension = file.NAME?.split('.').pop()?.toLowerCase() || 'bin';
    diskFileByObjectId.value.set(`n${file.ID}`, { name: `n${file.ID}.${extension}`, url: file.DOWNLOAD_URL });
  });
}

// Ссылка на файл Диска в тексте: без ZIP — просто подпись (файла рядом нет, ссылка на него
// бессмысленна), при выгрузке в ZIP — ссылка на файл, распакованный в папку assets/.
function formatFileLink(label, filename, forZip) {
  if (!forZip) return label;
  const path = `./assets/${filename}`;
  return textFormat.value === 'markdown' ? `[${label}](${path})` : `[URL=${path}]${label}[/URL]`;
}

function replaceInlineDiskFiles(text, forZip) {
  return (text || '').replace(DISK_FILE_INLINE_RE, (match, objectId) => {
    const file = diskFileByObjectId.value.get(`n${objectId}`);
    if (!file) return match;
    const label = `Файл: ${file.name}`;
    return forZip ? formatFileLink(label, file.name, forZip) : `[${label}]`;
  });
}

// В режиме Markdown тело (описание/комментарий) прогоняется через bbcodeToMarkdown — Bitrix
// хранит текст в BBCode, поэтому в исходном ("BBCode") режиме он остаётся как есть.
function formatBody(rawText, forZip) {
  const text = replaceInlineDiskFiles(rawText, forZip);
  return minifyPrompt(textFormat.value === 'markdown' ? bbcodeToMarkdown(text) : text);
}

function formatAttachmentsBlock(names, label, forZip) {
  if (!names.length) return '';
  if (textFormat.value === 'markdown') {
    return `\n\n**${label}:**\n${names.map((name) => `- ${formatFileLink(name, name, forZip)}`).join('\n')}`;
  }
  return `\n[${label}: ${names.map((name) => formatFileLink(name, name, forZip)).join(', ')}]`;
}

const taskStatusLabel = computed(() => TASK_STATUS_LABELS[taskStatus.value] ?? '');

// «Дата создания» вместе с точным числом прошедших дней — по просьбе пользователя, чтобы не
// пересчитывать вручную давность задачи.
function formatCreatedDateLine(createdDate) {
  const daysSinceCreation = dayjs().diff(dayjs(createdDate), 'day');
  return `${dayjs(createdDate).format('DD.MM.YYYY')} (${daysSinceCreation} ${pluralize(daysSinceCreation, ['день', 'дня', 'дней'])} назад)`;
}

function buildTaskMetaLines(isMarkdown, { createdDate, statusLabel, stageName = '' }) {
  const lines = [];
  if (createdDate) {
    lines.push(isMarkdown ? `**Дата создания:** ${formatCreatedDateLine(createdDate)}` : `Дата создания: ${formatCreatedDateLine(createdDate)}`);
  }
  if (statusLabel) {
    lines.push(isMarkdown ? `**Статус:** ${statusLabel}` : `Статус: ${statusLabel}`);
  }
  if (stageName) {
    lines.push(isMarkdown ? `**Стадия:** ${stageName}` : `Стадия: ${stageName}`);
  }
  return lines;
}

function formatComment(comment, index, forZip) {
  const author = [comment.AUTHOR_NAME, comment.AUTHOR_LAST_NAME].filter(Boolean).join(' ') || '?';
  const date = comment.POST_DATE ? dayjs(comment.POST_DATE).format('DD.MM.YY') : '';
  const text = formatBody(comment.POST_MESSAGE || '', forZip);

  // Вложения, у которых нет плейсхолдера [DISK FILE ID=...] в самом тексте комментария —
  // иначе они остаются в архиве, но нигде не упоминаются в экспортированном тексте.
  const inlineDiskFileIds = extractInlineDiskFileIds(comment.POST_MESSAGE);
  const attachmentNames = Object.values(comment.ATTACHED_OBJECTS ?? {})
    .filter((attachment) => attachment.DOWNLOAD_URL && !inlineDiskFileIds.has(attachmentDiskIdMap.value.get(String(attachment.ATTACHMENT_ID))))
    .map((attachment) => attachmentFileName(attachment.ATTACHMENT_ID, attachment.NAME));
  const attachmentsBlock = formatAttachmentsBlock(attachmentNames, 'Вложения', forZip);

  if (textFormat.value === 'markdown') {
    return `### ${index + 1}. ${author}${date ? ` (${date})` : ''}\n${text}${attachmentsBlock}`;
  }
  return `[${index + 1}] ${author}${date ? ` (${date})` : ''}:\n${text}${attachmentsBlock}`;
}

// Ссылки-ссылки на подзадачи в плоском тексте — иерархическая нумерация (1, 1.1, 1.2, 2...),
// depth выводится отступом в 2 пробела на уровень, чтобы дерево подзадач читалось и без разметки.
function formatSubtaskLines(nodes, forZip, parentRef = '') {
  const lines = [];
  nodes.forEach((node, index) => {
    const ref = parentRef ? `${parentRef}.${index + 1}` : `${index + 1}`;
    const depth = ref.split('.').length - 1;
    const indent = '  '.repeat(depth);
    const statusLabel = TASK_STATUS_LABELS[node.status] ?? '';
    const filesSuffix = node.files.length
      ? ` (Вложения: ${node.files.map((file) => formatFileLink(file.name, file.name, forZip)).join(', ')})`
      : '';

    const line = textFormat.value === 'markdown'
      ? `${indent}- **[${ref}]** ${node.title}${statusLabel ? ` — _${statusLabel}_` : ''}${filesSuffix}`
      : `${indent}[${ref}] ${node.title}${statusLabel ? ` — ${statusLabel}` : ''}${filesSuffix}`;

    lines.push(line, ...formatSubtaskLines(node.children, forZip, ref));
  });
  return lines;
}

// Предки выводятся от корневой задачи к прямому родителю. Когда их несколько, прямой помечается
// явно: по одному порядку номеров это не читается.
function formatParentTask(parent, index, forZip) {
  const isMarkdown = textFormat.value === 'markdown';
  const isDirectParent = parentTasks.value.length > 1 && index === parentTasks.value.length - 1;
  const directParentMark = isDirectParent ? (isMarkdown ? ' — _прямой родитель_' : ' — прямой родитель') : '';
  const numberPrefix = parentTasks.value.length > 1 ? (isMarkdown ? `${index + 1}. ` : `[${index + 1}] `) : '';
  const header = isMarkdown
    ? `### ${numberPrefix}${parent.title}${directParentMark}`
    : `${numberPrefix}${parent.title}${directParentMark}:`;

  const metaLines = buildTaskMetaLines(isMarkdown, {
    createdDate: parent.createdDate,
    statusLabel: TASK_STATUS_LABELS[parent.status] ?? '',
  });

  // Вложения, у которых нет плейсхолдера [DISK FILE ID=...] в самом описании — по тому же правилу,
  // что и у описания самой задачи.
  const inlineDiskFileIds = extractInlineDiskFileIds(parent.description);
  const attachmentNames = parent.files
    .filter((file) => !inlineDiskFileIds.has(file.diskFileId))
    .map((file) => file.name);

  const heading = [header, ...metaLines].join('\n');
  const body = [heading, formatBody(parent.description, forZip)].filter(Boolean).join('\n\n');
  return `${body}${formatAttachmentsBlock(attachmentNames, 'Вложения', forZip)}`;
}

const parentTasksHeading = computed(() => parentTasks.value.length > 1 ? 'Родительские задачи' : 'Родительская задача');

function buildText(forZip) {
  const isMarkdown = textFormat.value === 'markdown';
  const parts = [];

  if (includeExtraContext.value && extraContext.value.trim()) {
    const context = extraContext.value.trim();
    parts.push(isMarkdown ? `## Контекст\n${context}` : context);
  }

  if (includeTitle.value && taskTitle.value) {
    parts.push(isMarkdown ? `# ${taskTitle.value}` : taskTitle.value);
  }

  if (includeTitle.value || includeDescription.value) {
    const metaLines = buildTaskMetaLines(isMarkdown, {
      createdDate: taskCreatedDate.value,
      statusLabel: taskStatusLabel.value,
      stageName: taskStageName.value,
    });
    if (metaLines.length) parts.push(metaLines.join('\n'));
  }

  if (includeDescription.value) {
    const description = formatBody(taskDescription.value, forZip);

    // Вложения задачи, у которых нет плейсхолдера [DISK FILE ID=...] в самом тексте описания —
    // иначе они уже упомянуты через [Файл: ...] по месту вставки и не нужно дублировать их здесь.
    const inlineDiskFileIds = extractInlineDiskFileIds(taskDescription.value);
    const taskAttachmentNames = taskFileObjects.value
      .filter((file) => !inlineDiskFileIds.has(file.diskFileId))
      .map((file) => file.name);
    const attachmentsBlock = formatAttachmentsBlock(taskAttachmentNames, 'Вложения задачи', forZip);
    if (description || attachmentsBlock) {
      parts.push(`${isMarkdown ? '## Описание\n' : 'ОПИСАНИЕ:\n'}${description}${attachmentsBlock}`);
    }
  }

  if (selectedComments.value.length) {
    const block = selectedComments.value.map((comment, index) => formatComment(comment, index, forZip)).join('\n\n');
    parts.push(`${isMarkdown ? '## Комментарии\n\n' : 'КОММЕНТАРИИ:\n'}${block}`);
  }

  if (includeParentTasks.value && parentTasks.value.length) {
    const block = parentTasks.value.map((parent, index) => formatParentTask(parent, index, forZip)).join('\n\n');
    const heading = isMarkdown ? `## ${parentTasksHeading.value}\n\n` : `${parentTasksHeading.value.toUpperCase()}:\n`;
    parts.push(`${heading}${block}`);
  }

  if (includeSubtasks.value && subtasksTree.value.length) {
    const block = formatSubtaskLines(subtasksTree.value, forZip).join('\n');
    parts.push(`${isMarkdown ? '## Подзадачи\n\n' : 'ПОДЗАДАЧИ:\n'}${block}`);
  }

  return parts.join('\n\n');
}

function jsonAttachment(file, forZip) {
  return forZip ? { name: file.name, url: file.url, path: `./assets/${file.name}` } : { name: file.name, url: file.url };
}

function buildJson(forZip) {
  const result = {};

  if (includeExtraContext.value && extraContext.value.trim()) {
    result.context = extraContext.value.trim();
  }

  if ((includeTitle.value && taskTitle.value) || includeDescription.value) {
    result.task = {
      date: taskCreatedDate.value || null,
      daysSinceCreation: taskCreatedDate.value ? dayjs().diff(dayjs(taskCreatedDate.value), 'day') : null,
      status: taskStatusLabel.value || null,
      stage: taskStageName.value || null,
      author: taskAuthorName.value || null,
      ...(includeTitle.value && taskTitle.value && { title: taskTitle.value }),
      ...(includeDescription.value && {
        body: formatBody(taskDescription.value, forZip),
        attachments: collectTaskAttachmentFiles().map((file) => jsonAttachment(file, forZip)),
      }),
    };
  }

  if (includeComments.value && selectedComments.value.length) {
    result.comments = selectedComments.value.map((comment) => ({
      date: comment.POST_DATE || null,
      author: [comment.AUTHOR_NAME, comment.AUTHOR_LAST_NAME].filter(Boolean).join(' ') || null,
      body: formatBody(comment.POST_MESSAGE || '', forZip),
      attachments: collectCommentAttachmentFiles(comment).map((file) => jsonAttachment(file, forZip)),
    }));
  }

  if (includeParentTasks.value && parentTasks.value.length) {
    result.parentTasks = parentTasks.value.map((parent) => ({
      id: parent.id,
      title: parent.title,
      date: parent.createdDate || null,
      daysSinceCreation: parent.createdDate ? dayjs().diff(dayjs(parent.createdDate), 'day') : null,
      status: TASK_STATUS_LABELS[parent.status] ?? null,
      body: formatBody(parent.description, forZip),
      attachments: collectFiles(parent.files, parent.description).map((file) => jsonAttachment(file, forZip)),
    }));
  }

  if (includeSubtasks.value && subtasksTree.value.length) {
    result.subtasks = subtasksTree.value.map((node) => subtaskToJson(node, forZip));
  }

  return JSON.stringify(result, null, 2);
}

function subtaskToJson(node, forZip) {
  return {
    id: node.id,
    title: node.title,
    status: TASK_STATUS_LABELS[node.status] ?? null,
    attachments: node.files.map((file) => jsonAttachment(file, forZip)),
    subtasks: node.children.map((child) => subtaskToJson(child, forZip)),
  };
}

function buildOutput(forZip = false) {
  return exportAsJson.value ? buildJson(forZip) : buildText(forZip);
}

const resultText = computed(() => buildOutput());
const resultCharCount = computed(() => resultText.value.length);
const resultTokenEstimate = computed(() => estimateTokenCount(resultText.value));
const exportFileExtension = computed(() => {
  if (exportAsJson.value) return 'json';
  return textFormat.value === 'markdown' ? 'md' : 'txt';
});

const hasExportableContent = computed(() =>
  (includeDescription.value && (!!taskDescription.value || taskFileObjects.value.length > 0))
  || (includeComments.value && selectedComments.value.length > 0)
  || (includeSubtasks.value && subtasksTree.value.length > 0)
  || (includeParentTasks.value && parentTasks.value.length > 0),
);

// Сколько файлов уедет в архив при текущих переключателях. Кнопку при нуле не блокируем:
// комментарии и подзадачи грузятся лениво, и до их загрузки ноль означает «пока не знаем»
const attachmentFilesCount = computed(() => collectAttachmentFiles().length);

// Изображения среди файлов архива: оценка по площади осмысленна только для них — у PDF и офисных
// файлов размеров в пикселях нет, и считать их значило бы врать
const imageAttachmentFiles = computed(() => collectAttachmentFiles().filter((file) => isImageFileName(file.name)));
const measuredImageFiles = computed(() => imageAttachmentFiles.value.filter((file) => imageSizeByUrl.value.get(file.url)));
const imageTokenEstimate = computed(() => measuredImageFiles.value.reduce((sum, file) => {
  const { width, height } = imageSizeByUrl.value.get(file.url);
  return sum + estimateImageTokenCount(width, height);
}, 0));
const totalTokenEstimate = computed(() => resultTokenEstimate.value + imageTokenEstimate.value);
// Оценка по изображениям запрошена: либо нажата кнопка, либо она включена в настройках
const imageTokensRequested = computed(() => autoCountImageTokens.value || imagesMeasured.value);
const tokenEstimateTooltip = computed(() => {
  const textEstimateTip = 'Приблизительная оценка без токенайзера: ~4 символа на токен для латиницы/цифр/JSON и ~2.3 символа на токен для кириллицы, пропорционально её доле в тексте — реальное число может отличаться';
  if (!measuredImageFiles.value.length) return textEstimateTip;
  return `${textEstimateTip}. Изображения (учтено: ${measuredImageFiles.value.length}) считаются по площади — ширина × высота, ~750 пикселей на токен, без поправки на то, как их обработает конкретная модель`;
});

// Размеры берём из самого изображения, а это его загрузка — потому только по кнопке. Декодируем
// байты через createImageBitmap, а не через <img>: DOWNLOAD_URL Диска отдаёт файл как вложение,
// и изображение в <img> по такой ссылке может не загрузиться
async function loadImageSize(url) {
  try {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const response = await fetch(fullUrl, { credentials: 'include' });
    const bitmap = await createImageBitmap(await response.blob());
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

// Замеров может идти несколько сразу (см. watch ниже), а спиннер один — гасим его, только когда
// закончился последний, иначе первый же завершившийся снимал бы его с ещё работающих
let runningMeasurements = 0;

async function measureImageSizes() {
  const unmeasuredFiles = imageAttachmentFiles.value.filter((file) => !imageSizeByUrl.value.has(file.url));
  imagesMeasured.value = true;
  if (!unmeasuredFiles.length) return;

  // Ключ занимаем до запроса, а не после: список изображений догружается порциями, и следующий
  // замер иначе счёл бы эти файлы неизмеренными и выкачал бы их второй раз. В подсчёт заглушка
  // не попадёт — measuredImageFiles отбирает по непустому значению
  unmeasuredFiles.forEach((file) => imageSizeByUrl.value.set(file.url, null));

  runningMeasurements += 1;
  measuringImages.value = true;
  try {
    const sizes = await Promise.all(unmeasuredFiles.map((file) => loadImageSize(file.url)));
    unmeasuredFiles.forEach((file, index) => imageSizeByUrl.value.set(file.url, sizes[index]));
  } finally {
    runningMeasurements -= 1;
    if (!runningMeasurements) measuringImages.value = false;
  }
}

// После первой оценки состав файлов ещё меняется — комментарии и подзадачи грузятся лениво, да и
// переключатели никто не отменял. Новые изображения домеряем сами, иначе цифра молча устареет
watch(imageAttachmentFiles, () => {
  if (imageTokensRequested.value) measureImageSizes();
});

// Файлы одной сущности (задачи, комментария, родительской задачи): формальные вложения плюс
// инлайн-изображения из её текста. Map по имени — один и тот же файл Диска может быть и вложением,
// и инлайн-изображением одновременно, имя у него одно.
function collectFiles(attachmentFiles, text) {
  const filesByName = new Map();
  const addFile = (file) => {
    if (file && !filesByName.has(file.name)) filesByName.set(file.name, file);
  };

  attachmentFiles.forEach(addFile);
  extractInlineDiskFileIds(text).forEach((diskFileId) => addFile(diskFileByObjectId.value.get(diskFileId)));

  return [...filesByName.values()];
}

// Все файлы задачи (формальные вложения + инлайн-изображения в описании) — независимо от того,
// упомянуты ли они уже отдельным плейсхолдером [Файл: ...] в тексте описания.
function collectTaskAttachmentFiles() {
  return collectFiles(taskFileObjects.value, includeDescription.value ? taskDescription.value : '');
}

// Все файлы одного комментария (формальные вложения + инлайн-изображения в тексте).
function collectCommentAttachmentFiles(comment) {
  const attachmentFiles = Object.values(comment.ATTACHED_OBJECTS ?? {})
    .filter((attachment) => attachment.DOWNLOAD_URL)
    .map((attachment) => ({ name: attachmentFileName(attachment.ATTACHMENT_ID, attachment.NAME), url: attachment.DOWNLOAD_URL }));

  return collectFiles(attachmentFiles, comment.POST_MESSAGE);
}

// Файлы всех подзадач дерева (рекурсивно, включая вложенные подзадачи подзадач).
function collectSubtaskAttachmentFiles(nodes) {
  return nodes.flatMap((node) => [...node.files, ...collectSubtaskAttachmentFiles(node.children)]);
}

function collectAttachmentFiles() {
  const filesByName = new Map();
  const addFile = (file) => {
    if (file && !filesByName.has(file.name)) filesByName.set(file.name, file);
  };

  if (includeComments.value) {
    selectedComments.value.forEach((comment) => collectCommentAttachmentFiles(comment).forEach(addFile));
  }

  collectTaskAttachmentFiles().forEach(addFile);

  if (includeSubtasks.value) {
    collectSubtaskAttachmentFiles(subtasksTree.value).forEach(addFile);
  }

  if (includeParentTasks.value) {
    parentTasks.value.forEach((parent) => collectFiles(parent.files, parent.description).forEach(addFile));
  }

  return [...filesByName.values()];
}

async function loadComments() {
  loadingComments.value = true;
  try {
    const comments = await api.getComments(props.taskId);
    allComments.value = comments;

    const commentAttachmentIds = [];
    const inlineDiskFileIds = new Set();
    comments.forEach((comment) => {
      Object.values(comment.ATTACHED_OBJECTS ?? {}).forEach((attachment) => {
        if (attachment.ATTACHMENT_ID) commentAttachmentIds.push(String(attachment.ATTACHMENT_ID));
      });
      extractInlineDiskFileIds(comment.POST_MESSAGE).forEach((diskFileId) => inlineDiskFileIds.add(diskFileId));
    });

    if (commentAttachmentIds.length) {
      const commentAttachedObjects = await api.getAttachedObjectsBatch(commentAttachmentIds).catch(() => []);
      registerDiskIds(commentAttachedObjects);
    }

    await resolveInlineDiskFiles(inlineDiskFileIds);

    commentsLoaded.value = true;
  } catch {
    showToast({ severity: 'error', summary: 'Ошибка загрузки комментариев', life: 3000 });
  } finally {
    loadingComments.value = false;
  }
}

// Обходит дерево подзадач уровень за уровнем (BFS): на каждом уровне один запрос searchTasks
// по всем ID-родителям этого уровня сразу, вместо запроса на каждую подзадачу по отдельности.
// Уровень пуст → дерево закончилось, цикл останавливается сам.
async function loadSubtasks() {
  loadingSubtasks.value = true;
  try {
    const childrenByParentId = new Map();
    const visitedIds = new Set([String(props.taskId)]);
    let currentLevelIds = [props.taskId];
    let depth = 0;

    while (currentLevelIds.length && depth < MAX_SUBTASK_DEPTH) {
      depth += 1;
      const levelTasks = await api.searchTasks({
        parentIds: currentLevelIds,
        extraSelectFields: ['STATUS', 'UF_TASK_WEBDAV_FILES'],
      });

      levelTasks.forEach((task) => {
        const parentKey = String(task.parentId);
        if (!childrenByParentId.has(parentKey)) childrenByParentId.set(parentKey, []);
        childrenByParentId.get(parentKey).push(task);
      });

      // Спускаемся только в ещё не посещённые задачи: Bitrix циклов между родителем и потомком не
      // допускает, но одна испорченная запись в данных иначе завесила бы обход навсегда
      currentLevelIds = levelTasks
        .map((task) => String(task.id))
        .filter((taskId) => !visitedIds.has(taskId));
      currentLevelIds.forEach((taskId) => visitedIds.add(taskId));
    }

    if (currentLevelIds.length) {
      showToast({
        severity: 'warn',
        summary: 'Подзадачи',
        detail: `Дерево глубже ${MAX_SUBTASK_DEPTH} уровней — в выгрузку попали только первые ${MAX_SUBTASK_DEPTH}.`,
        life: 5000,
      });
    }

    const subtaskAttachmentIds = [];
    childrenByParentId.forEach((tasks) => {
      tasks.forEach((task) => {
        (task.ufTaskWebdavFiles ?? []).forEach((attachmentId) => subtaskAttachmentIds.push(String(attachmentId)));
      });
    });

    if (subtaskAttachmentIds.length) {
      const subtaskAttachedObjects = await api.getAttachedObjectsBatch(subtaskAttachmentIds).catch(() => []);
      registerDiskIds(subtaskAttachedObjects);
    }

    const buildNodes = (parentId) => (childrenByParentId.get(String(parentId)) ?? []).map((task) => ({
      id: String(task.id),
      title: task.title,
      status: task.status,
      files: (task.ufTaskWebdavFiles ?? [])
        .map((attachmentId) => diskFileByObjectId.value.get(attachmentDiskIdMap.value.get(String(attachmentId))))
        .filter(Boolean),
      children: buildNodes(task.id),
    }));

    subtasksTree.value = buildNodes(props.taskId);
    subtasksLoaded.value = true;
  } catch {
    showToast({ severity: 'error', summary: 'Ошибка загрузки подзадач', life: 3000 });
  } finally {
    loadingSubtasks.value = false;
  }
}

// Поднимается по PARENT_ID от задачи к корневой. Следующий предок известен только из ответа по
// предыдущему, поэтому запросы идут по одному; вложения всей цепочки добираются одним батчем.
async function loadParentTasks() {
  loadingParentTasks.value = true;
  try {
    const chain = [];
    const visitedIds = new Set([String(props.taskId)]);
    let currentParentId = taskParentId.value;

    while (currentParentId && !visitedIds.has(currentParentId) && chain.length < MAX_PARENT_DEPTH) {
      visitedIds.add(currentParentId);

      const { data } = await api.getTask(currentParentId, ['ID', 'TITLE', 'DESCRIPTION', 'UF_TASK_WEBDAV_FILES', 'CREATED_DATE', 'STATUS', 'PARENT_ID']);
      const parentTask = data?.result?.task;
      if (!parentTask) break;

      // unshift, а не push: цепочка хранится от корневой задачи к прямому родителю — так контекст
      // читается сверху вниз, от общего к частному
      chain.unshift({
        id: String(parentTask.id ?? currentParentId),
        title: parentTask.title ?? '',
        description: parentTask.description ?? '',
        createdDate: parentTask.createdDate ?? '',
        status: parentTask.status ?? '',
        attachmentIds: (parentTask.ufTaskWebdavFiles ?? []).map(String).filter(Boolean),
        files: [],
      });

      currentParentId = String(parentTask.parentId ?? '');
      if (currentParentId === '0') currentParentId = '';
    }

    const parentAttachmentIds = chain.flatMap((parent) => parent.attachmentIds);
    if (parentAttachmentIds.length) {
      const parentAttachedObjects = await api.getAttachedObjectsBatch(parentAttachmentIds).catch(() => []);
      registerDiskIds(parentAttachedObjects);
    }

    chain.forEach((parent) => {
      parent.files = parent.attachmentIds
        .map((attachmentId) => {
          const diskFileId = attachmentDiskIdMap.value.get(attachmentId);
          const file = diskFileByObjectId.value.get(diskFileId);
          return file && { ...file, diskFileId };
        })
        .filter(Boolean);
    });

    const inlineDiskFileIds = new Set(chain.flatMap((parent) => [...extractInlineDiskFileIds(parent.description)]));
    await resolveInlineDiskFiles(inlineDiskFileIds);

    parentTasks.value = chain;
    parentTasksLoaded.value = true;
  } catch {
    showToast({ severity: 'error', summary: 'Ошибка загрузки родительской задачи', life: 3000 });
  } finally {
    loadingParentTasks.value = false;
  }
}

onMounted(async () => {
  try {
    const storedSettings = await chrome.storage.local.get([SETTINGS_STORAGE_KEY]);
    const settings = storedSettings[SETTINGS_STORAGE_KEY];
    if (settings) {
      includeTitle.value = settings.includeTitle ?? true;
      includeDescription.value = settings.includeDescription ?? true;
      includeComments.value = settings.includeComments ?? true;
      includeSubtasks.value = settings.includeSubtasks ?? false;
      includeParentTasks.value = settings.includeParentTasks ?? false;
      textFormat.value = settings.textFormat ?? 'bbcode';
      exportAsJson.value = settings.exportAsJson ?? false;
      archiveNameTemplate.value = settings.archiveNameTemplate || DEFAULT_ARCHIVE_NAME_TEMPLATE;
      showArchiveNameInput.value = settings.showArchiveNameInput ?? false;
      autoCountImageTokens.value = settings.autoCountImageTokens ?? false;
    }

    const [taskResponse] = await Promise.all([
      api.getTask(props.taskId, ['TITLE', 'DESCRIPTION', 'UF_TASK_WEBDAV_FILES', 'GROUP_ID', 'CREATED_DATE', 'CREATED_BY', 'STATUS', 'STAGE_ID', 'PARENT_ID']),
      includeComments.value ? loadComments() : Promise.resolve(),
      includeSubtasks.value ? loadSubtasks() : Promise.resolve(),
    ]);

    const task = taskResponse.data?.result?.task ?? {};
    taskTitle.value = task.title ?? '';
    taskDescription.value = task.description ?? '';
    taskCreatedDate.value = task.createdDate ?? '';
    taskStatus.value = task.status ?? '';
    taskAuthorId.value = String(task.createdBy ?? '');
    // У корневой задачи Bitrix отдаёт parentId = 0 — приводим к пустой строке, чтобы тумблер скрылся
    taskParentId.value = task.parentId && String(task.parentId) !== '0' ? String(task.parentId) : '';
    groupId.value = String(task.groupId ?? '');

    refreshArchiveName();

    if (exportAsJson.value) await loadTaskAuthor();

    if (groupId.value && task.stageId) {
      api.getStages(groupId.value).then(({ data }) => {
        const stage = Object.values(data?.result ?? {}).find((candidate) => String(candidate.ID) === String(task.stageId));
        taskStageName.value = stage?.TITLE ?? '';
      }).catch(() => {});
    }

    const storedContext = await chrome.storage.local.get([extraContextStorageKey.value]);
    if (storedContext[extraContextStorageKey.value]) {
      extraContext.value = storedContext[extraContextStorageKey.value];
      includeExtraContext.value = true;
    }

    const taskAttachmentIds = (task.ufTaskWebdavFiles ?? []).map(String).filter(Boolean);
    if (taskAttachmentIds.length) {
      const taskAttachedObjects = await api.getAttachedObjectsBatch(taskAttachmentIds).catch(() => []);
      registerDiskIds(taskAttachedObjects);
      taskFileObjects.value = taskAttachedObjects
        .filter((attachedObject) => attachedObject?.DOWNLOAD_URL)
        .map((attachedObject) => ({
          name: attachmentFileName(attachedObject.ID, attachedObject.NAME),
          url: attachedObject.DOWNLOAD_URL,
          diskFileId: attachmentDiskIdMap.value.get(String(attachedObject.ID)),
        }));
    }

    await resolveInlineDiskFiles(extractInlineDiskFileIds(taskDescription.value));

    // Загружается последней: ID родителя известен только из ответа по самой задаче
    if (includeParentTasks.value && taskParentId.value) await loadParentTasks();
  } catch (error) {
    console.error(error);
    showToast({ severity: 'error', summary: 'Ошибка загрузки данных задачи', life: 3000 });
  } finally {
    isInitializing = false;
    loading.value = false;
  }
});

// Перевод названия задачи выполняется один раз за сеанс окна: он может занять время (Chrome
// докачивает языковой пакет), а название задачи в открытом окне не меняется.
async function getTranslatedTaskSlug() {
  if (translatedTaskSlug !== null) return translatedTaskSlug;

  translatingSlug.value = true;
  try {
    translatedTaskSlug = slugify(await translateRuToEn(getTaskTitleText(taskTitle.value)) ?? '');
    if (!translatedTaskSlug) {
      showToast({
        severity: 'warn',
        summary: 'Перевод названия недоступен',
        detail: 'В названии архива использована транслитерация.',
        life: 5000,
      });
    }
    return translatedTaskSlug;
  } finally {
    translatingSlug.value = false;
  }
}

// Название сразу заполняется по шаблону с транслитерацией названия задачи, а перевод
// подставляется, когда придёт — и только если пользователь не успел поправить название руками.
async function refreshArchiveName() {
  const nameWithTransliteratedSlug = renderArchiveName(archiveNameTemplate.value, props.taskId, slugify(getTaskTitleText(taskTitle.value)));
  archiveName.value = nameWithTransliteratedSlug;

  if (!archiveNameTemplate.value.includes(ARCHIVE_NAME_SLUG_PLACEHOLDER) || !taskTitle.value) return;

  const translatedSlug = await getTranslatedTaskSlug();
  if (!translatedSlug || archiveName.value !== nameWithTransliteratedSlug) return;

  archiveName.value = renderArchiveName(archiveNameTemplate.value, props.taskId, translatedSlug);
}

function onSaveSettings({ archiveNameTemplate: template, showArchiveNameInput: showInput, autoCountImageTokens: autoCount }) {
  archiveNameTemplate.value = template;
  showArchiveNameInput.value = showInput;
  autoCountImageTokens.value = autoCount;
  if (autoCountImageTokens.value) measureImageSizes();
  refreshArchiveName();
  isSettingsOpened.value = false;
  showToast({ severity: 'success', summary: 'Настройки сохранены', life: 3000 });
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(buildOutput());
    showToast({ severity: 'success', summary: 'Скопировано!', life: 2000 });
  } catch {
    showToast({ severity: 'error', summary: 'Ошибка копирования', life: 3000 });
  }
}

function downloadTxt() {
  const mimeType = exportAsJson.value ? 'application/json' : textFormat.value === 'markdown' ? 'text/markdown' : 'text/plain';
  const blob = new Blob([buildOutput()], { type: `${mimeType};charset=utf-8` });
  downloadBlob(blob, `task-${props.taskId}.${exportFileExtension.value}`);
}

async function downloadZip() {
  downloadingZip.value = true;
  try {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file(`description.${exportFileExtension.value}`, buildOutput(true));

    const attachmentFiles = collectAttachmentFiles();
    if (attachmentFiles.length) {
      const attachmentsFolder = zip.folder('assets');
      await Promise.allSettled(
        attachmentFiles.map(async ({ name, url }) => {
          const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
          const response = await fetch(fullUrl, { credentials: 'include' });
          attachmentsFolder.file(name, await response.blob());
        }),
      );
    }

    const fileName = withZipExtension(archiveName.value.trim() || renderArchiveName(archiveNameTemplate.value, props.taskId));
    downloadBlob(await zip.generateAsync({ type: 'blob' }), fileName);

    showToast({ severity: 'success', summary: 'Архив скачан!', life: 2000 });
  } catch (error) {
    console.error(error);
    showToast({ severity: 'error', summary: 'Ошибка создания архива', life: 3000 });
  } finally {
    downloadingZip.value = false;
  }
}
</script>

<template>
  <div
    v-if="loading"
    class="flex flex-col gap-3 py-2"
  >
    <Skeleton height="24px" />
    <Skeleton height="24px" />
    <Skeleton height="24px" />
  </div>

  <div
    v-else
    class="flex flex-col gap-4 py-1"
  >
    <Button
      label="Настройки"
      icon="pi pi-cog"
      severity="secondary"
      variant="text"
      size="small"
      class="self-start"
      @click="isSettingsOpened = true"
    />

    <FormField label="Формат текста">
      <SelectButton
        v-model="textFormat"
        :options="textFormatOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        size="small"
      />
    </FormField>

    <div class="flex items-center gap-2 select-none">
      <ToggleSwitch
        v-model="exportAsJson"
        input-id="toggle-json"
      />
      <label
        for="toggle-json"
        class="text-sm font-medium cursor-pointer"
      >Экспортировать как JSON</label>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2 select-none">
        <ToggleSwitch
          v-model="includeExtraContext"
          input-id="toggle-extra-context"
        />
        <label
          for="toggle-extra-context"
          class="text-sm font-medium cursor-pointer"
        >Доп. контекст</label>
      </div>
      <Textarea
        v-if="includeExtraContext"
        :value="extraContext"
        rows="4"
        fluid
        placeholder="Стек, ограничения, пожелания..."
        @input="onExtraContextInput"
      />
    </div>

    <div class="flex items-center gap-2 select-none">
      <ToggleSwitch
        v-model="includeTitle"
        input-id="toggle-title"
      />
      <label
        for="toggle-title"
        class="text-sm font-medium cursor-pointer"
      >Заголовок</label>
    </div>

    <div class="flex items-center gap-2 select-none">
      <ToggleSwitch
        v-model="includeDescription"
        input-id="toggle-description"
        :disabled="!taskDescription"
      />
      <label
        for="toggle-description"
        class="text-sm font-medium"
        :class="!taskDescription ? 'text-surface-400 dark:text-surface-500 cursor-default' : 'cursor-pointer'"
      >
        Описание
        <span
          v-if="!taskDescription"
          class="text-xs font-normal"
        > — нет</span>
      </label>
    </div>

    <div class="flex items-center gap-2 select-none">
      <ToggleSwitch
        v-model="includeComments"
        input-id="toggle-comments"
      />
      <label
        for="toggle-comments"
        class="text-sm font-medium cursor-pointer"
      >
        Комментарии
        <span
          v-if="commentsLoaded"
          class="text-xs font-normal text-surface-400 dark:text-surface-500"
        >
          {{ userComments.length }}
        </span>
      </label>
    </div>

    <div
      v-if="taskParentId"
      class="flex items-center gap-2 select-none"
    >
      <ToggleSwitch
        v-model="includeParentTasks"
        input-id="toggle-parent-tasks"
      />
      <label
        for="toggle-parent-tasks"
        class="text-sm font-medium cursor-pointer"
      >
        {{ parentTasksHeading }}
        <span
          v-if="parentTasksLoaded"
          class="text-xs font-normal text-surface-400 dark:text-surface-500"
        >
          {{ parentTasks.length }}
        </span>
      </label>
    </div>

    <div class="flex items-center gap-2 select-none">
      <ToggleSwitch
        v-model="includeSubtasks"
        input-id="toggle-subtasks"
      />
      <label
        for="toggle-subtasks"
        class="text-sm font-medium cursor-pointer"
      >
        Подзадачи
        <span
          v-if="subtasksLoaded"
          class="text-xs font-normal text-surface-400 dark:text-surface-500"
        >
          {{ subtasksCount }}
        </span>
      </label>
    </div>

    <FormField
      v-if="showArchiveNameInput"
      id="export-task-archive-name"
      label="Название архива"
      tip="Формируется по шаблону из настроек, можно изменить перед скачиванием"
    >
      <IconField>
        <InputText
          id="export-task-archive-name"
          v-model="archiveName"
          fluid
          size="small"
        />
        <InputIcon
          v-if="translatingSlug"
          v-tooltip="'Название задачи переводится на английский'"
          class="pi pi-spinner pi-spin"
        />
      </IconField>
    </FormField>

    <div class="flex gap-2 flex-wrap pt-1 border-t border-surface-200 dark:border-surface-700 items-center">
      <Button
        label="Скопировать"
        icon="pi pi-copy"
        size="small"
        :disabled="loadingComments || loadingSubtasks || loadingParentTasks || !hasExportableContent"
        @click="copyToClipboard"
      />
      <Button
        :label="`.${exportFileExtension}`"
        icon="pi pi-file"
        severity="secondary"
        size="small"
        :disabled="loadingComments || loadingSubtasks || loadingParentTasks || !hasExportableContent"
        @click="downloadTxt"
      />
      <Button
        :label="attachmentFilesCount ? `ZIP + файлы (${attachmentFilesCount})` : 'ZIP + файлы'"
        icon="pi pi-file-import"
        severity="secondary"
        size="small"
        :loading="downloadingZip"
        :disabled="loadingComments || loadingSubtasks || loadingParentTasks || !hasExportableContent"
        @click="downloadZip"
      />
      <span class="ml-auto flex flex-wrap items-center justify-end gap-1 text-xs text-surface-400 dark:text-surface-500 whitespace-nowrap">
        {{ resultCharCount.toLocaleString('ru') }} симв. / ≈{{ resultTokenEstimate.toLocaleString('ru') }} ткн.<template v-if="measuredImageFiles.length">
          / ≈{{ totalTokenEstimate.toLocaleString('ru') }} ткн. с изображениями
        </template>
        <i
          v-tooltip="tokenEstimateTooltip"
          class="pi pi-question-circle"
        />
        <Button
          v-if="!imageTokensRequested && imageAttachmentFiles.length"
          :label="`Учесть изображения (${imageAttachmentFiles.length})`"
          icon="pi pi-image"
          severity="secondary"
          variant="text"
          size="small"
          :loading="measuringImages"
          @click="measureImageSizes"
        />
      </span>
    </div>
  </div>

  <Dialog
    v-model:visible="isSettingsOpened"
    header="Настройки"
    dismissable-mask
    modal
  >
    <SettingsForm
      :initial="{ archiveNameTemplate, showArchiveNameInput, autoCountImageTokens }"
      @success="onSaveSettings"
    />
  </Dialog>
</template>
