<script setup>
import {Button, Skeleton} from 'primevue';
import {onMounted, ref, useTemplateRef} from 'vue';

import BitrixApi from '../../../BitrixApi.js';
import {buildDescriptionFiles, createEditorAttachments} from '../../../editorFiles.js';
import {showToast} from '../../../toastHost/showToast.js';
import BbcodeEditor from '../../../ui/BbcodeEditor.vue';
import EditorAttachments from '../../../ui/EditorAttachments.vue';

const props = defineProps({
  sessionId: {type: String, required: true},
  taskId: {type: String, required: true},
  // Картинки, уже вставленные в описание, — снятые со страницы до того, как блок спрятали
  pageImages: {type: Array, default: () => []},
});

const emit = defineEmits(['close']);

const api = new BitrixApi(props.sessionId);
const editor = useTemplateRef('editor');

const description = ref('');
const files = ref([]);
const isLoading = ref(true);
const isSaving = ref(false);
let originalDescription = '';
const attachments = createEditorAttachments(api);
const isUploading = attachments.isUploading;

// Текст берём сырым BBCode с сервера, а не из отрендеренного блока: в HTML вместо файлов уже картинки,
// и их плейсхолдеры при сохранении потерялись бы
onMounted(async () => {
  try {
    const {data} = await api.getTask(props.taskId, ['DESCRIPTION']);
    originalDescription = data?.result?.task?.description ?? '';
    description.value = originalDescription;
    files.value = buildDescriptionFiles(originalDescription, props.pageImages);
    isLoading.value = false;
  } catch (error) {
    console.warn(error);
    showToast({severity: 'error', summary: 'Не удалось загрузить описание', detail: error.message, life: 5000});
    emit('close', false);
  }
});

async function save() {
  if (isSaving.value || isLoading.value || isUploading.value) return;
  isSaving.value = true;
  try {
    await editor.value?.sync();
    // Не трогали текст — его и не отправляем: редактор всё равно переложил бы его по-своему
    const isDescriptionChanged = description.value !== originalDescription;
    const hasNewFiles = attachments.files.some((file) => !file.isAttached);
    if (!isDescriptionChanged && !hasNewFiles) {
      emit('close', false);
      return;
    }

    // Файлы — до текста: тегу в описании нужен уже прикреплённый файл
    await attachments.attachToTask(props.taskId);
    if (isDescriptionChanged) {
      const {data} = await api.updateTask(props.taskId, {DESCRIPTION: description.value});
      if (!data?.result) throw new Error(data?.error_description || 'Bitrix не подтвердил изменение задачи');
    }
    emit('close', true);
  } catch (error) {
    console.warn(error);
    showToast({
      severity: 'error',
      summary: 'Не удалось сохранить описание',
      detail: error.response?.data?.error_description || error.message,
      life: 6000,
    });
    isSaving.value = false;
  }
}

function cancel() {
  if (isSaving.value) return;
  emit('close', false);
}

// Esc не должен долететь до Bitrix: в слайдере он закрыл бы саму задачу
function onKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    cancel();
  } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    save();
  }
}
</script>

<template>
  <div
    class="flex flex-col gap-2 my-2"
    @keydown="onKeydown"
  >
    <Skeleton
      v-if="isLoading"
      height="160px"
    />
    <BbcodeEditor
      v-else
      ref="editor"
      v-model="description"
      :files="[...files, ...attachments.imageInfos.value]"
      :upload-image="attachments.uploadImage"
      :disabled="isSaving"
      :min-height="160"
      :max-height="600"
      placeholder="Описание задачи. Изображение можно вставить через Ctrl+V или перетащить сюда"
    />
    <EditorAttachments
      v-if="!isLoading"
      v-model:text="description"
      :attachments="attachments"
      :editor="editor"
      :disabled="isSaving"
    />

    <div class="flex flex-wrap items-center gap-2">
      <Button
        label="Сохранить"
        icon="pi pi-check"
        size="small"
        :loading="isSaving"
        :disabled="isLoading || isUploading"
        @click="save"
      />
      <Button
        label="Отмена"
        size="small"
        severity="secondary"
        variant="text"
        :disabled="isSaving"
        @click="cancel"
      />
      <span class="text-xs text-surface-500 dark:text-surface-400">
        Ctrl+Enter — сохранить, Esc — отменить. Документы, уже вставленные в описание, упоминания и другие теги, которые редактор не поддерживает, видны как BBCode — не удаляйте их, и они сохранятся.
      </span>
    </div>
  </div>
</template>
