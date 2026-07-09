<script setup>
import dayjs from 'dayjs';
import { Button, SelectButton, Skeleton, Textarea, ToggleSwitch } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { DISK_FILE_INLINE_RE } from '../../../patterns.js';
import FormField from '../../../ui/FormField.vue';
import { bbcodeToMarkdown, isSystemComment, minifyPrompt } from '../../../utils.js';

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

const toast = useToast();
const api = new BitrixApi(props.sessionId);

const loading = ref(true);
const loadingComments = ref(false);
const commentsLoaded = ref(false);
const taskTitle = ref('');
const taskDescription = ref('');
const taskCreatedDate = ref('');
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

watch([includeTitle, includeDescription, includeComments, textFormat, exportAsJson], () => {
  if (isInitializing) return;
  chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: {
      includeTitle: includeTitle.value,
      includeDescription: includeDescription.value,
      includeComments: includeComments.value,
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

  return JSON.stringify(result, null, 2);
}

function buildOutput(forZip = false) {
  return exportAsJson.value ? buildJson(forZip) : buildText(forZip);
}

const resultText = computed(() => buildOutput());
const resultCharCount = computed(() => resultText.value.length);
const exportFileExtension = computed(() => {
  if (exportAsJson.value) return 'json';
  return textFormat.value === 'markdown' ? 'md' : 'txt';
});

const hasExportableContent = computed(() =>
  (includeDescription.value && (!!taskDescription.value || taskFileObjects.value.length > 0))
  || (includeComments.value && selectedComments.value.length > 0),
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
    toast.add({ group: 'export-task', severity: 'error', summary: 'Ошибка загрузки комментариев', life: 3000 });
  } finally {
    loadingComments.value = false;
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
      textFormat.value = settings.textFormat ?? 'bbcode';
      exportAsJson.value = settings.exportAsJson ?? false;
    }

    const [taskResponse] = await Promise.all([
      api.getTask(props.taskId, ['TITLE', 'DESCRIPTION', 'UF_TASK_WEBDAV_FILES', 'GROUP_ID', 'CREATED_DATE', 'CREATED_BY']),
      includeComments.value ? loadComments() : Promise.resolve(),
    ]);

    const task = taskResponse.data?.result?.task ?? {};
    taskTitle.value = task.title ?? '';
    taskDescription.value = task.description ?? '';
    taskCreatedDate.value = task.createdDate ?? '';
    taskAuthorId.value = String(task.createdBy ?? '');
    groupId.value = String(task.groupId ?? '');

    if (exportAsJson.value) await loadTaskAuthor();

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
    toast.add({ group: 'export-task', severity: 'error', summary: 'Ошибка загрузки данных задачи', life: 3000 });
  } finally {
    isInitializing = false;
    loading.value = false;
  }
});

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(buildOutput());
    toast.add({ group: 'export-task', severity: 'success', summary: 'Скопировано!', life: 2000 });
  } catch {
    toast.add({ group: 'export-task', severity: 'error', summary: 'Ошибка копирования', life: 3000 });
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

    toast.add({ group: 'export-task', severity: 'success', summary: 'Архив скачан!', life: 2000 });
  } catch (error) {
    console.error(error);
    toast.add({ group: 'export-task', severity: 'error', summary: 'Ошибка создания архива', life: 3000 });
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
        :disabled="commentsLoaded && !userComments.length"
      />
      <label
        for="toggle-comments"
        class="text-sm font-medium"
        :class="commentsLoaded && !userComments.length ? 'text-surface-400 cursor-default' : 'cursor-pointer'"
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

    <div class="flex gap-2 flex-wrap pt-1 border-t border-surface-200 items-center">
      <Button
        label="Скопировать"
        icon="pi pi-copy"
        size="small"
        :disabled="loadingComments || !hasExportableContent"
        @click="copyToClipboard"
      />
      <Button
        :label="`.${exportFileExtension}`"
        icon="pi pi-file"
        severity="secondary"
        size="small"
        :disabled="loadingComments || !hasExportableContent"
        @click="downloadTxt"
      />
      <Button
        label="ZIP + файлы"
        icon="pi pi-file-import"
        severity="secondary"
        size="small"
        :loading="downloadingZip"
        :disabled="loadingComments || !hasExportableContent"
        @click="downloadZip"
      />
      <span class="ml-auto text-xs text-surface-400 whitespace-nowrap">
        {{ resultCharCount.toLocaleString('ru') }} симв.
      </span>
    </div>
  </div>
</template>
