<script setup>
/**
 * Визуальный BBCode-редактор Bitrix (как в новой карточке задачи) с `v-model` в BBCode.
 * Работает только в content scripts на странице Bitrix. Если редактор на портале недоступен,
 * вместо него показывается обычная `Textarea`.
 */
import {Textarea} from 'primevue';
import {onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';

import {mountTextEditor} from '../textEditorBridge.js';

const props = defineProps({
  placeholder: {type: String, default: ''},
  minHeight: {type: Number, default: 120},
  maxHeight: {type: Number, default: 400},
  disabled: {type: Boolean, default: false},
});

const model = defineModel({type: String, default: ''});

const container = useTemplateRef('container');
const status = ref('loading');

let editor = null;
let isUnmounted = false;
// Последний текст, пришедший из редактора: его возврат через v-model не надо слать обратно
let lastEditorText = model.value;

onMounted(async () => {
  const initialContent = model.value;
  const mounted = await mountTextEditor(container.value, {
    content: initialContent,
    placeholder: props.placeholder,
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
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

// Разметка редактора живёт до конца анимации закрытия окна: удалив её сразу, получили бы
// окно, из которого посреди анимации пропадает поле описания
const DESTROY_DELAY_MS = 500;

onBeforeUnmount(() => {
  isUnmounted = true;
  const mounted = editor;
  if (mounted) setTimeout(() => mounted.destroy(), DESTROY_DELAY_MS);
});

defineExpose({sync});
</script>

<template>
  <Textarea
    v-if="status === 'fallback'"
    v-model="model"
    rows="5"
    fluid
    :disabled
    :placeholder
  />
  <div
    v-else
    class="relative"
  >
    <div ref="container" />
    <div
      v-if="status === 'loading'"
      class="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400"
    >
      <i class="pi pi-spin pi-spinner" />
      Загрузка редактора…
    </div>
  </div>
</template>
