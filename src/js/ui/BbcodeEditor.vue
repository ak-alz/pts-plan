<script setup>
/**
 * Визуальный BBCode-редактор Bitrix (как в новой карточке задачи) с `v-model` в BBCode.
 * Работает только в content scripts на странице Bitrix. Если редактор на портале недоступен или
 * передан `plain`, вместо него показывается обычная `Textarea`.
 * С `uploadImage` изображения можно вставлять из буфера обмена и перетаскиванием: функция загружает
 * файл и возвращает сведения о нём для плагина File (см. `files` у `mountTextEditor`). В `Textarea`
 * на место курсора встаёт тег `[disk file id=…]`.
 */
import {Textarea} from 'primevue';
import {onBeforeUnmount, onMounted, ref, toRaw, useTemplateRef, watch} from 'vue';

import {buildDiskFileTag, removeDiskFileTag} from '../editorFiles.js';
import {mountTextEditor} from '../textEditorBridge.js';
import {showToast} from '../toastHost/showToast.js';

const props = defineProps({
  placeholder: {type: String, default: ''},
  minHeight: {type: Number, default: 120},
  maxHeight: {type: Number, default: 400},
  disabled: {type: Boolean, default: false},
  // Обычное текстовое поле вместо визуального редактора. Читается при монтировании — для
  // переключения на лету пересоздавайте компонент через :key
  plain: {type: Boolean, default: false},
  rows: {type: Number, default: 5},
  // Классы самого текстового поля (у корня компонента они до него не доходят)
  inputClass: {type: String, default: ''},
  // Файлы Диска, уже упомянутые в тексте, — чтобы показать их картинками
  files: {type: Array, default: null},
  // (file: File) => Promise<object> — загружает изображение и отдаёт сведения о нём для вставки
  uploadImage: {type: Function, default: null},
});

const model = defineModel({type: String, default: ''});

const container = useTemplateRef('container');
const fallbackTextarea = useTemplateRef('fallbackTextarea');
const status = ref(props.plain ? 'fallback' : 'loading');

let editor = null;
let isUnmounted = false;
// Последний текст, пришедший из редактора: его возврат через v-model не надо слать обратно
let lastEditorText = model.value;

onMounted(async () => {
  if (props.plain) return;
  const initialContent = model.value;
  // Сведения уходят в main world через postMessage, а реактивный Proxy туда не клонируется
  const files = props.files ? structuredClone(toRaw(props.files).map((file) => toRaw(file))) : null;
  const mounted = await mountTextEditor(container.value, {
    content: initialContent,
    placeholder: props.placeholder,
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
    files: files ?? (props.uploadImage ? [] : null),
    onChange(text) {
      lastEditorText = text;
      model.value = text;
    },
  });

  if (isUnmounted) {
    mounted?.destroy();
    return;
  }

  editor = mounted;
  status.value = editor ? 'ready' : 'fallback';
  if (!editor) return;

  // Пока редактор грузился, наблюдатель ниже изменения пропускал — догоняем их
  if (model.value !== initialContent) {
    lastEditorText = model.value;
    editor.setText(model.value);
  }
  if (props.disabled) editor.setEditable(false);
});

/**
 * Забирает текст прямо из редактора в `v-model`. Изменения приходят из main world сообщениями и
 * могут отставать от ввода — вызывайте перед тем, как читать значение (отправка формы и т. п.).
 * @returns {Promise<void>}
 */
async function sync() {
  if (!editor) return;
  const text = await editor.getText();
  if (text === null || text === lastEditorText) return;
  lastEditorText = text;
  model.value = text;
}

// Текст поменяли снаружи (сброс формы, генерация) — переносим его в редактор
watch(model, (text) => {
  if (!editor || text === lastEditorText) return;
  lastEditorText = text;
  editor.setText(text);
});

watch(() => props.disabled, (disabled) => {
  editor?.setEditable(!disabled);
});

const uploadingCount = ref(0);

/**
 * Вставляет файл Диска в текст на место курсора: в редакторе — картинкой, в текстовом поле — тегом.
 * @param {object} info Сведения о файле для плагина File
 */
function insertFile(info) {
  if (editor) {
    editor.insertFile(toRaw(info));
    return;
  }
  const text = model.value;
  const textarea = fallbackTextarea.value?.$el;
  // Курсора в поле не было — тег уходит в конец; selectionStart сохраняется и без фокуса
  const position = textarea ? textarea.selectionStart : text.length;
  model.value = `${text.slice(0, position)}${buildDiskFileTag(info.serverFileId)}${text.slice(position)}`;
}

/**
 * Убирает файл Диска из текста.
 * @param {string} serverFileId ID как в теге: `n123` или `456`
 */
function removeFile(serverFileId) {
  if (editor) {
    editor.removeFile(serverFileId);
    return;
  }
  model.value = removeDiskFileTag(model.value, serverFileId);
}

function getImageFiles(dataTransfer) {
  return [...(dataTransfer?.files ?? [])].filter((file) => file.type.startsWith('image/'));
}

function canUploadImages() {
  return !!props.uploadImage && !props.disabled && (!!editor || status.value === 'fallback');
}

async function insertImages(files) {
  for (const file of files) {
    uploadingCount.value += 1;
    try {
      const info = await props.uploadImage(file);
      if (info && !isUnmounted) insertFile(info);
    } catch (error) {
      console.warn(error);
      showToast({severity: 'error', summary: 'Не удалось загрузить изображение', detail: error.message, life: 6000});
    } finally {
      uploadingCount.value -= 1;
    }
  }
}

// Слушаем в фазе захвата: событие нужно перехватить раньше редактора, иначе он вставит файл по-своему
function onPaste(event) {
  if (!canUploadImages()) return;
  const files = getImageFiles(event.clipboardData);
  if (!files.length) return;
  event.preventDefault();
  event.stopPropagation();
  insertImages(files);
}

function onDragOver(event) {
  if (canUploadImages() && event.dataTransfer?.types.includes('Files')) event.preventDefault();
}

// dragover мы уже приняли для любых файлов — значит, и бросок любого файла гасим сами, иначе браузер
// откроет его вместо страницы и несохранённый текст пропадёт
function onDrop(event) {
  if (!canUploadImages() || !event.dataTransfer?.files.length) return;
  event.preventDefault();
  event.stopPropagation();
  const files = getImageFiles(event.dataTransfer);
  if (files.length) {
    insertImages(files);
    return;
  }
  showToast({severity: 'info', summary: 'В текст вставляются только изображения', detail: 'Другие файлы прикрепите под полем — кнопкой «Прикрепить файл» или перетаскиванием туда.', life: 5000});
}

// Разметка редактора живёт до конца анимации закрытия окна: удалив её сразу, получили бы
// окно, из которого посреди анимации пропадает поле описания
const DESTROY_DELAY_MS = 500;

onBeforeUnmount(() => {
  isUnmounted = true;
  const mounted = editor;
  if (mounted) setTimeout(() => mounted.destroy(), DESTROY_DELAY_MS);
});

defineExpose({sync, insertFile, removeFile});
</script>

<template>
  <div
    class="relative"
    @paste.capture="onPaste"
    @dragover.capture="onDragOver"
    @drop.capture="onDrop"
  >
    <Textarea
      v-if="status === 'fallback'"
      ref="fallbackTextarea"
      v-model="model"
      :rows
      :class="inputClass"
      fluid
      :disabled
      :placeholder
    />
    <div
      v-else
      ref="container"
    />
    <div
      v-if="uploadingCount > 0"
      class="flex items-center gap-2 mt-1 text-sm text-surface-500 dark:text-surface-400"
    >
      <i class="pi pi-spin pi-spinner" />
      Загрузка изображения…
    </div>
    <div
      v-if="status === 'loading'"
      class="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400"
    >
      <i class="pi pi-spin pi-spinner" />
      Загрузка редактора…
    </div>
  </div>
</template>
