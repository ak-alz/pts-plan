<script setup>
import dayjs from 'dayjs';
import { Button, Skeleton, Textarea, ToggleSwitch } from 'primevue';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import { minifyPrompt } from '../../../utils.js';

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
const taskFileObjects = ref([]);
const allComments = ref([]);
const groupId = ref('');

const includeExtraContext = ref(false);
const extraContext = ref('');
const includeTitle = ref(true);
const includeDescription = ref(true);
const includeComments = ref(true);
const downloadingZip = ref(false);
const attachmentDiskIdMap = ref(new Map()); // ATTACHMENT_ID → "n{OBJECT_ID}"

const SETTINGS_STORAGE_KEY = 'export-task-settings';
const extraContextStorageKey = computed(() => `export-task-context-${groupId.value}`);

let isInitializing = true;

watch([includeTitle, includeDescription, includeComments], () => {
  if (isInitializing) return;
  chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: {
      includeTitle: includeTitle.value,
      includeDescription: includeDescription.value,
      includeComments: includeComments.value,
    },
  });
});

watch(includeComments, async (newValue) => {
  if (isInitializing) return;
  if (newValue && !commentsLoaded.value) {
    await loadComments();
  }
});

async function onExtraContextInput(event) {
  extraContext.value = event.target.value;
  await chrome.storage.local.set({ [extraContextStorageKey.value]: extraContext.value });
}

// Системные авто-сообщения Битрикса — фиксированные фразы в тексте
const SYSTEM_PHRASES = [
  'вы назначены исполнителем',
  'вы добавлены наблюдателем',
  'вы добавлены соисполнителем',
  'вы назначены постановщиком',
  'назначен новый исполнитель',
  'добавлен наблюдатель',
  'удалён наблюдатель',
  'удален наблюдатель',
  'необходимо указать крайний срок',
  'задача поставлена на контроль',
  'задача снята с контроля',
  'задача завершена',
  'задача отложена',
  'задача возобновлена',
  'изменён статус задачи',
  'изменен статус задачи',
  'изменён крайний срок',
  'изменен крайний срок',
];

function isSystemComment(comment) {
  const text = (comment.POST_MESSAGE || '').toLowerCase();
  return SYSTEM_PHRASES.some((phrase) => text.includes(phrase));
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

function formatComment(comment, index) {
  const author = [comment.AUTHOR_NAME, comment.AUTHOR_LAST_NAME].filter(Boolean).join(' ') || '?';
  const date = comment.POST_DATE ? dayjs(comment.POST_DATE).format('DD.MM.YY') : '';
  const text = minifyPrompt(comment.POST_MESSAGE || '');
  return `[${index + 1}] ${author}${date ? ` (${date})` : ''}:\n${text}`;
}

function buildText() {
  const parts = [];

  if (includeExtraContext.value && extraContext.value.trim()) {
    parts.push(extraContext.value.trim());
  }

  if (includeTitle.value && taskTitle.value) {
    parts.push(taskTitle.value);
  }

  if (includeDescription.value) {
    const description = minifyPrompt(taskDescription.value);
    const taskAttachmentNames = taskFileObjects.value.map((file) => file.name);
    const attachmentsLine = taskAttachmentNames.length ? `\n[Вложения задачи: ${taskAttachmentNames.join(', ')}]` : '';
    if (description || attachmentsLine) {
      parts.push(`ОПИСАНИЕ:\n${description}${attachmentsLine}`);
    }
  }

  if (selectedComments.value.length) {
    const block = selectedComments.value.map((comment, index) => formatComment(comment, index)).join('\n\n');
    parts.push(`КОММЕНТАРИИ:\n${block}`);
  }

  return parts.join('\n\n');
}

const resultCharCount = computed(() => buildText().length);

const hasExportableContent = computed(() =>
  (includeDescription.value && (!!taskDescription.value || taskFileObjects.value.length > 0))
  || (includeComments.value && selectedComments.value.length > 0),
);

function collectAttachmentFiles() {
  const files = [];

  if (includeComments.value) {
    selectedComments.value.forEach((comment) => {
      Object.values(comment.ATTACHED_OBJECTS ?? {}).forEach((attachment) => {
        if (attachment.DOWNLOAD_URL) {
          files.push({ name: attachmentFileName(attachment.ATTACHMENT_ID, attachment.NAME), url: attachment.DOWNLOAD_URL });
        }
      });
    });
  }

  files.push(...taskFileObjects.value);

  return files;
}

async function loadComments() {
  loadingComments.value = true;
  try {
    const comments = await api.getComments(props.taskId);
    allComments.value = comments;

    const commentAttachmentIds = [];
    comments.forEach((comment) => {
      Object.values(comment.ATTACHED_OBJECTS ?? {}).forEach((attachment) => {
        if (attachment.ATTACHMENT_ID) commentAttachmentIds.push(String(attachment.ATTACHMENT_ID));
      });
    });

    if (commentAttachmentIds.length) {
      const commentAttachedObjects = await api.getAttachedObjectsBatch(commentAttachmentIds).catch(() => []);
      const diskIdMap = new Map();
      commentAttachedObjects.forEach((attachedObject) => {
        if (attachedObject?.ID && attachedObject?.OBJECT_ID) {
          diskIdMap.set(String(attachedObject.ID), `n${attachedObject.OBJECT_ID}`);
        }
      });
      attachmentDiskIdMap.value = diskIdMap;
    }

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
    }

    const [taskResponse] = await Promise.all([
      api.getTask(props.taskId, ['TITLE', 'DESCRIPTION', 'UF_TASK_WEBDAV_FILES', 'GROUP_ID']),
      includeComments.value ? loadComments() : Promise.resolve(),
    ]);

    const task = taskResponse.data?.result?.task ?? {};
    taskTitle.value = task.title ?? '';
    taskDescription.value = task.description ?? '';
    groupId.value = String(task.groupId ?? '');

    const storedContext = await chrome.storage.local.get([extraContextStorageKey.value]);
    if (storedContext[extraContextStorageKey.value]) {
      extraContext.value = storedContext[extraContextStorageKey.value];
      includeExtraContext.value = true;
    }

    const taskAttachmentIds = (task.ufTaskWebdavFiles ?? []).map(String).filter(Boolean);
    if (taskAttachmentIds.length) {
      const taskAttachedObjects = await api.getAttachedObjectsBatch(taskAttachmentIds).catch(() => []);
      taskFileObjects.value = taskAttachedObjects
        .filter((attachedObject) => attachedObject?.DOWNLOAD_URL)
        .map((attachedObject) => ({
          name: attachmentFileName(attachedObject.ID, attachedObject.NAME),
          url: attachedObject.DOWNLOAD_URL,
        }));
    }
  } catch {
    toast.add({ group: 'export-task', severity: 'error', summary: 'Ошибка загрузки данных задачи', life: 3000 });
  } finally {
    isInitializing = false;
    loading.value = false;
  }
});

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(buildText());
    toast.add({ group: 'export-task', severity: 'success', summary: 'Скопировано!', life: 2000 });
  } catch {
    toast.add({ group: 'export-task', severity: 'error', summary: 'Ошибка копирования', life: 3000 });
  }
}

function downloadTxt() {
  const blob = new Blob([buildText()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `task-${props.taskId}.txt` }).click();
  URL.revokeObjectURL(url);
}

async function downloadZip() {
  downloadingZip.value = true;
  try {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('task.txt', buildText());

    const attachmentFiles = collectAttachmentFiles();
    if (attachmentFiles.length) {
      const attachmentsFolder = zip.folder('files');
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
        label=".txt"
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
