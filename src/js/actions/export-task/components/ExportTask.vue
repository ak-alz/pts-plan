<script setup>
import dayjs from 'dayjs';
import { Button, Message, SelectButton, Skeleton, Textarea, ToggleSwitch } from 'primevue';
import { computed, onMounted, ref, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { DISK_FILE_INLINE_RE } from '../../../patterns.js';
import { showToast } from '../../../toastHost/showToast.js';
import FormField from '../../../ui/FormField.vue';
import { bbcodeToMarkdown, estimateTokenCount, isSystemComment, minifyPrompt, pluralize, TASK_STATUS_LABELS } from '../../../utils.js';

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
const taskTitle = ref('');
const taskDescription = ref('');
const taskCreatedDate = ref('');
const taskStatus = ref('');
const taskStageName = ref('');
const taskAuthorId = ref('');
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
const textFormat = ref('bbcode'); // формат самого текста (описание/комментарии) — независим от exportAsJson
const exportAsJson = ref(false); // оборачивает результат в JSON-структуру вместо плоского текста
const downloadingZip = ref(false);
const attachmentDiskIdMap = ref(new Map()); // ATTACHMENT_ID → "n{OBJECT_ID}"
const diskFileByObjectId = ref(new Map()); // "n{OBJECT_ID}" → { name, url } — все известные файлы Диска (вложения + инлайн-картинки в тексте)

const textFormatOptions = [
  { label: 'BBCode', value: 'bbcode' },
  { label: 'Markdown', value: 'markdown' },
];

const SETTINGS_STORAGE_KEY = 'export-task-settings';
const extraContextStorageKey = computed(() => `export-task-context-${groupId.value}`);

let isInitializing = true;
let authorLoaded = false;

watch([includeTitle, includeDescription, includeComments, includeSubtasks, textFormat, exportAsJson], () => {
  if (isInitializing) return;
  chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: {
      includeTitle: includeTitle.value,
      includeDescription: includeDescription.value,
      includeComments: includeComments.value,
      includeSubtasks: includeSubtasks.value,
      textFormat: textFormat.value,
      exportAsJson: exportAsJson.value,
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
function formatCreatedDateLine() {
  const daysSinceCreation = dayjs().diff(dayjs(taskCreatedDate.value), 'day');
  return `${dayjs(taskCreatedDate.value).format('DD.MM.YYYY')} (${daysSinceCreation} ${pluralize(daysSinceCreation, ['день', 'дня', 'дней'])} назад)`;
}

function buildTaskMetaLines(isMarkdown) {
  const lines = [];
  if (taskCreatedDate.value) {
    lines.push(isMarkdown ? `**Дата создания:** ${formatCreatedDateLine()}` : `Дата создания: ${formatCreatedDateLine()}`);
  }
  if (taskStatusLabel.value) {
    lines.push(isMarkdown ? `**Статус:** ${taskStatusLabel.value}` : `Статус: ${taskStatusLabel.value}`);
  }
  if (taskStageName.value) {
    lines.push(isMarkdown ? `**Стадия:** ${taskStageName.value}` : `Стадия: ${taskStageName.value}`);
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
    const metaLines = buildTaskMetaLines(isMarkdown);
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
  || (includeSubtasks.value && subtasksTree.value.length > 0),
);

// Все файлы задачи (формальные вложения + инлайн-картинки в описании) — независимо от того,
// упомянуты ли они уже отдельным плейсхолдером [Файл: ...] в тексте описания.
function collectTaskAttachmentFiles() {
  const filesByName = new Map();
  const addFile = (file) => {
    if (file && !filesByName.has(file.name)) filesByName.set(file.name, file);
  };

  taskFileObjects.value.forEach(addFile);
  if (includeDescription.value) {
    extractInlineDiskFileIds(taskDescription.value).forEach((diskFileId) => addFile(diskFileByObjectId.value.get(diskFileId)));
  }

  return [...filesByName.values()];
}

// Все файлы одного комментария (формальные вложения + инлайн-картинки в тексте).
function collectCommentAttachmentFiles(comment) {
  const filesByName = new Map();
  const addFile = (file) => {
    if (file && !filesByName.has(file.name)) filesByName.set(file.name, file);
  };

  Object.values(comment.ATTACHED_OBJECTS ?? {}).forEach((attachment) => {
    if (attachment.DOWNLOAD_URL) {
      addFile({ name: attachmentFileName(attachment.ATTACHMENT_ID, attachment.NAME), url: attachment.DOWNLOAD_URL });
    }
  });
  extractInlineDiskFileIds(comment.POST_MESSAGE).forEach((diskFileId) => addFile(diskFileByObjectId.value.get(diskFileId)));

  return [...filesByName.values()];
}

// Файлы всех подзадач дерева (рекурсивно, включая вложенные подзадачи подзадач).
function collectSubtaskAttachmentFiles(nodes) {
  return nodes.flatMap((node) => [...node.files, ...collectSubtaskAttachmentFiles(node.children)]);
}

function collectAttachmentFiles() {
  // Map по имени файла — один и тот же файл Диска может быть и вложением, и инлайн-картинкой
  // в тексте одновременно (например, вставленное в комментарий изображение), имя у него одно.
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
    let currentLevelIds = [props.taskId];

    while (currentLevelIds.length) {
      const levelTasks = await api.searchTasks({
        parentIds: currentLevelIds,
        extraSelectFields: ['STATUS', 'UF_TASK_WEBDAV_FILES'],
      });

      levelTasks.forEach((task) => {
        const parentKey = String(task.parentId);
        if (!childrenByParentId.has(parentKey)) childrenByParentId.set(parentKey, []);
        childrenByParentId.get(parentKey).push(task);
      });

      currentLevelIds = levelTasks.map((task) => String(task.id));
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

onMounted(async () => {
  try {
    const storedSettings = await chrome.storage.local.get([SETTINGS_STORAGE_KEY]);
    const settings = storedSettings[SETTINGS_STORAGE_KEY];
    if (settings) {
      includeTitle.value = settings.includeTitle ?? true;
      includeDescription.value = settings.includeDescription ?? true;
      includeComments.value = settings.includeComments ?? true;
      includeSubtasks.value = settings.includeSubtasks ?? false;
      textFormat.value = settings.textFormat ?? 'bbcode';
      exportAsJson.value = settings.exportAsJson ?? false;
    }

    const [taskResponse] = await Promise.all([
      api.getTask(props.taskId, ['TITLE', 'DESCRIPTION', 'UF_TASK_WEBDAV_FILES', 'GROUP_ID', 'CREATED_DATE', 'CREATED_BY', 'STATUS', 'STAGE_ID']),
      includeComments.value ? loadComments() : Promise.resolve(),
      includeSubtasks.value ? loadSubtasks() : Promise.resolve(),
    ]);

    const task = taskResponse.data?.result?.task ?? {};
    taskTitle.value = task.title ?? '';
    taskDescription.value = task.description ?? '';
    taskCreatedDate.value = task.createdDate ?? '';
    taskStatus.value = task.status ?? '';
    taskAuthorId.value = String(task.createdBy ?? '');
    groupId.value = String(task.groupId ?? '');

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
  } catch {
    showToast({ severity: 'error', summary: 'Ошибка загрузки данных задачи', life: 3000 });
  } finally {
    isInitializing = false;
    loading.value = false;
  }
});

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
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `task-${props.taskId}.${exportFileExtension.value}` }).click();
  URL.revokeObjectURL(url);
}

async function downloadZip() {
  downloadingZip.value = true;
  try {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file(`task.${exportFileExtension.value}`, buildOutput(true));

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

    const blobUrl = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
    Object.assign(document.createElement('a'), { href: blobUrl, download: `task-${props.taskId}.zip` }).click();
    URL.revokeObjectURL(blobUrl);

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
        :class="!taskDescription ? 'text-surface-400 cursor-default' : 'cursor-pointer'"
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
          class="text-xs font-normal text-surface-400"
        >
          {{ userComments.length }}
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
          class="text-xs font-normal text-surface-400"
        >
          {{ subtasksCount }}
        </span>
      </label>
    </div>

    <Message
      severity="info"
      size="small"
      variant="simple"
    >
      Макеты из Figma автоматически не экспортируются — выгрузите PDF вручную из Figma и приложите его в папку задачи на Диске.
    </Message>

    <div class="flex gap-2 flex-wrap pt-1 border-t border-surface-200 items-center">
      <Button
        label="Скопировать"
        icon="pi pi-copy"
        size="small"
        :disabled="loadingComments || loadingSubtasks || !hasExportableContent"
        @click="copyToClipboard"
      />
      <Button
        :label="`.${exportFileExtension}`"
        icon="pi pi-file"
        severity="secondary"
        size="small"
        :disabled="loadingComments || loadingSubtasks || !hasExportableContent"
        @click="downloadTxt"
      />
      <Button
        label="ZIP + файлы"
        icon="pi pi-file-import"
        severity="secondary"
        size="small"
        :loading="downloadingZip"
        :disabled="loadingComments || loadingSubtasks || !hasExportableContent"
        @click="downloadZip"
      />
      <span class="ml-auto flex items-center gap-1 text-xs text-surface-400 whitespace-nowrap">
        {{ resultCharCount.toLocaleString('ru') }} {{ pluralize(resultCharCount, ['символ', 'символа', 'символов']) }} / ≈{{ resultTokenEstimate.toLocaleString('ru') }} {{ pluralize(resultTokenEstimate, ['токен', 'токена', 'токенов']) }}
        <i
          v-tooltip="'Приблизительная оценка без токенайзера: ~4 символа на токен для латиницы/цифр/JSON и ~2.3 символа на токен для кириллицы, пропорционально её доле в тексте — реальное число может отличаться'"
          class="pi pi-question-circle"
        />
      </span>
    </div>
  </div>
</template>
