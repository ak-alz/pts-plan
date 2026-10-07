<script setup>
/**
 * Вложения под визуальным редактором, как в форме Bitrix: зона «Прикрепить файл» (по кнопке или
 * перетаскиванием) с подсказкой про вставку изображений и список загруженных файлов. Картинку из списка можно вставить в текст, любой файл — открепить (вместе
 * с его тегом в тексте). Без визуального редактора (обычное текстовое поле) тег правится прямо
 * в `v-model:text`. Сами файлы и прикрепление к задаче — в `createEditorAttachments`.
 * Только для content scripts.
 */
import {Button} from 'primevue';
import {ref, useTemplateRef} from 'vue';

import {buildDiskFileTag, removeDiskFileTag} from '../editorFiles.js';
import {showToast} from '../toastHost/showToast.js';
import {formatBytes} from '../utils.js';

const props = defineProps({
  // Результат createEditorAttachments
  attachments: {type: Object, required: true},
  // Экземпляр BbcodeEditor — через него файл вставляется в текст и убирается из него
  editor: {type: Object, default: null},
  disabled: {type: Boolean, default: false},
});

const text = defineModel('text', {type: String, default: ''});

const fileInput = useTemplateRef('fileInput');
const isDragOver = ref(false);

async function uploadFiles(files) {
  for (const file of files) {
    try {
      await props.attachments.upload(file);
    } catch (error) {
      console.warn(error);
      showToast({severity: 'error', summary: `Не удалось загрузить «${file.name}»`, detail: error.message, life: 6000});
    }
  }
}

function onFilesSelected(event) {
  const selectedFiles = [...event.target.files];
  // Сбрасываем сразу, иначе повторный выбор того же файла не вызовет change
  event.target.value = '';
  uploadFiles(selectedFiles);
}

function onDragOver(event) {
  if (props.disabled || !event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  isDragOver.value = true;
}

// dragleave приходит и при переходе на дочерний элемент зоны — гасим подсветку, только покинув её целиком
function onDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) isDragOver.value = false;
}

function onDrop(event) {
  isDragOver.value = false;
  if (props.disabled || !event.dataTransfer?.files.length) return;
  event.preventDefault();
  uploadFiles([...event.dataTransfer.files]);
}

function insert(item) {
  if (props.editor) props.editor.insertFile(item.info);
  else text.value = [text.value.trimEnd(), buildDiskFileTag(item.info.serverFileId)].filter(Boolean).join('\n');
}

function remove(item) {
  if (item.diskFileId) {
    if (props.editor) props.editor.removeFile(`n${item.diskFileId}`);
    else text.value = removeDiskFileTag(text.value, `n${item.diskFileId}`);
  }
  props.attachments.remove(item);
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      class="flex flex-col items-start gap-0.5 px-2 py-1.5 rounded border border-dashed transition-colors"
      :class="isDragOver ? 'border-primary bg-surface-50 dark:bg-surface-800' : 'border-surface-300 dark:border-surface-600'"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <Button
        label="Прикрепить файл"
        icon="pi pi-paperclip"
        size="small"
        severity="secondary"
        variant="text"
        :disabled
        @click="fileInput.click()"
      />
      <span class="px-2.5 pb-1.5 text-xs text-surface-500 dark:text-surface-400">
        или перетащите файлы сюда. Изображение можно вставить прямо в текст — Ctrl+V или перетаскиванием в поле
      </span>
      <input
        ref="fileInput"
        type="file"
        multiple
        class="hidden"
        @change="onFilesSelected"
      >
    </div>

    <ul
      v-if="attachments.files.length"
      class="flex flex-col gap-1 m-0 p-0 list-none"
    >
      <li
        v-for="item in attachments.files"
        :key="item.key"
        class="flex items-center gap-2 px-2 py-1 rounded border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 text-sm"
      >
        <img
          v-if="item.info"
          :src="item.info.previewUrl"
          :alt="item.name"
          class="w-8 h-8 object-cover rounded shrink-0"
        >
        <i
          v-else-if="item.isUploading"
          class="pi pi-spin pi-spinner w-8 text-center shrink-0 text-surface-500 dark:text-surface-400"
        />
        <i
          v-else
          class="pi pi-file w-8 text-center shrink-0 text-surface-500 dark:text-surface-400"
        />
        <span class="truncate text-surface-700 dark:text-surface-0">{{ item.name }}</span>
        <span class="shrink-0 text-xs text-surface-500 dark:text-surface-400">{{ formatBytes(item.size) }}</span>
        <div class="flex items-center gap-1 ml-auto shrink-0">
          <Button
            v-if="item.info"
            label="Вставить в текст"
            icon="pi pi-image"
            size="small"
            severity="secondary"
            variant="text"
            :disabled
            @mousedown.prevent
            @click="insert(item)"
          />
          <Button
            v-tooltip.top="'Открепить'"
            icon="pi pi-times"
            size="small"
            severity="secondary"
            variant="text"
            :disabled="disabled || item.isUploading"
            @click="remove(item)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
