<script setup>
import { Button, Dialog, InputText, Message, Textarea } from 'primevue';
import { computed, nextTick, ref, watch } from 'vue';

import { findUnknownPromptVariables } from '../aiPromptLibrary.js';

/**
 * Кнопка «Промпты» для AI-фич и окно библиотеки промптов: выбрать стандартный или свой, создать
 * свой на основе стандартного, править его со вставкой переменных, удалить. Ставится рядом с
 * кнопкой предпросмотра промпта; всё состояние — в объекте из `usePromptLibrary`.
 */
const props = defineProps({
  library: {
    type: Object,
    required: true,
  },
});

const DEFAULT_ID = 'default';

const visible = ref(false);
const selectedId = ref(DEFAULT_ID);
const deleteConfirm = ref(false);
const templateInput = ref(null);

// Разбирается один раз: библиотека на весь срок жизни компонента. Если она может смениться
// (например, у фичи по библиотеке на режим), ставьте кнопке :key — иначе окно останется со старой
const { spec, prompts, defaultTemplate } = props.library;

const selectedPrompt = computed(() => prompts.value.find((prompt) => prompt.id === selectedId.value) ?? null);
const isActive = (id) => (id === DEFAULT_ID ? !props.library.activePrompt.value : props.library.activePrompt.value?.id === id);
const buttonTooltip = computed(() => `Промпты: ${props.library.activePrompt.value?.name ?? 'стандартный'}`);

const unknownVariables = computed(() => (selectedPrompt.value ? findUnknownPromptVariables(selectedPrompt.value.template, spec.variables) : []));
// Собирается в скрипте: «}}» внутри выражения шаблона закрыло бы интерполяцию раньше времени
const unknownVariablesLabel = computed(() => unknownVariables.value.map((key) => `{{${key}}}`).join(', '));

watch(visible, (isVisible) => {
  if (!isVisible) return;
  selectedId.value = props.library.activePrompt.value?.id ?? DEFAULT_ID;
  deleteConfirm.value = false;
});

watch(selectedId, () => {
  deleteConfirm.value = false;
});

function createFromDefault() {
  const number = prompts.value.length + 1;
  selectedId.value = props.library.createPrompt({ name: `Мой промпт ${number}`, template: defaultTemplate });
}

function duplicateSelected() {
  if (!selectedPrompt.value) return;
  selectedId.value = props.library.createPrompt({
    name: `${selectedPrompt.value.name} (копия)`,
    template: selectedPrompt.value.template,
  });
}

function deleteSelected() {
  props.library.deletePrompt(selectedId.value);
  selectedId.value = DEFAULT_ID;
}

function update(field, value) {
  props.library.updatePrompt(selectedId.value, { [field]: value });
}

// Переменная вставляется туда, где стоит курсор, а не в конец — шаблон обычно уже большой
async function insertVariable(key) {
  const element = templateInput.value?.$el;
  const template = selectedPrompt.value.template;
  const token = `{{${key}}}`;
  const start = element?.selectionStart ?? template.length;
  const end = element?.selectionEnd ?? template.length;

  update('template', `${template.slice(0, start)}${token}${template.slice(end)}`);

  await nextTick();
  element?.focus();
  element?.setSelectionRange(start + token.length, start + token.length);
}
</script>

<template>
  <Button
    v-tooltip="buttonTooltip"
    size="small"
    severity="secondary"
    :icon="library.activePrompt.value ? 'pi pi-book text-primary' : 'pi pi-book'"
    @click="visible = true"
  />

  <Dialog
    v-model:visible="visible"
    :header="`Промпты: ${spec.title}`"
    dismissable-mask
    modal
    :style="{ width: '900px' }"
  >
    <div class="flex gap-4 min-h-0">
      <div class="w-56 shrink-0 flex flex-col gap-1">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg border-0 px-2 py-1 text-left text-sm cursor-pointer text-surface-700 dark:text-surface-0"
          :class="selectedId === DEFAULT_ID ? 'bg-surface-100 dark:bg-surface-800 font-semibold' : 'bg-transparent hover:bg-surface-50 dark:hover:bg-surface-800'"
          @click="selectedId = DEFAULT_ID"
        >
          <i class="pi pi-lock text-surface-400 dark:text-surface-500" />
          <span class="grow">Стандартный</span>
          <i
            v-if="isActive(DEFAULT_ID)"
            v-tooltip="'Используется'"
            class="pi pi-check text-primary"
          />
        </button>
        <button
          v-for="prompt in prompts"
          :key="prompt.id"
          type="button"
          class="flex w-full items-center gap-2 rounded-lg border-0 px-2 py-1 text-left text-sm cursor-pointer text-surface-700 dark:text-surface-0"
          :class="selectedId === prompt.id ? 'bg-surface-100 dark:bg-surface-800 font-semibold' : 'bg-transparent hover:bg-surface-50 dark:hover:bg-surface-800'"
          @click="selectedId = prompt.id"
        >
          <i class="pi pi-file-edit text-surface-400 dark:text-surface-500" />
          <span class="grow truncate">{{ prompt.name || 'Без названия' }}</span>
          <i
            v-if="isActive(prompt.id)"
            v-tooltip="'Используется'"
            class="pi pi-check text-primary"
          />
        </button>
        <Button
          v-tooltip.top="'Создаётся копией стандартного промпта — её можно переписать'"
          label="Новый промпт"
          icon="pi pi-plus"
          size="small"
          severity="secondary"
          variant="text"
          class="mt-1 justify-start"
          @click="createFromDefault"
        />
      </div>

      <div
        v-if="!selectedPrompt"
        class="grow min-w-0 flex flex-col gap-3"
      >
        <p class="m-0 text-sm text-surface-500 dark:text-surface-400">
          Встроенный промпт расширения. Изменить его нельзя — создайте свой на его основе и правьте как угодно. Вернуться к стандартному можно в любой момент.
        </p>
        <pre class="m-0 text-xs font-mono whitespace-pre-wrap break-words max-h-[55vh] overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-2">{{ defaultTemplate }}</pre>
        <div class="flex gap-2">
          <Button
            v-if="!isActive(DEFAULT_ID)"
            label="Вернуть стандартный"
            icon="pi pi-replay"
            size="small"
            @click="library.setActive(null)"
          />
          <Button
            label="Создать свой на его основе"
            icon="pi pi-copy"
            size="small"
            severity="secondary"
            @click="createFromDefault"
          />
        </div>
      </div>

      <div
        v-else
        class="grow min-w-0 flex flex-col gap-3"
      >
        <InputText
          :model-value="selectedPrompt.name"
          size="small"
          fluid
          placeholder="Название промпта"
          @update:model-value="update('name', $event)"
        />

        <div class="flex flex-col gap-1">
          <span class="text-xs text-surface-500 dark:text-surface-400">Переменные — нажмите, чтобы вставить в место курсора:</span>
          <div class="flex flex-wrap gap-1">
            <Button
              v-for="variable in spec.variables"
              :key="variable.key"
              v-tooltip.top="variable.description || null"
              :label="variable.label"
              size="small"
              severity="secondary"
              variant="outlined"
              @click="insertVariable(variable.key)"
            />
          </div>
        </div>

        <Textarea
          ref="templateInput"
          :model-value="selectedPrompt.template"
          rows="16"
          fluid
          class="font-mono text-xs"
          spellcheck="false"
          @update:model-value="update('template', $event)"
        />

        <Message
          v-if="spec.formatNote"
          severity="info"
          size="small"
          :closable="false"
        >
          {{ spec.formatNote }}
        </Message>
        <Message
          v-if="unknownVariables.length"
          severity="warn"
          size="small"
          :closable="false"
        >
          Неизвестные переменные: {{ unknownVariablesLabel }} — они уйдут нейросети как есть.
        </Message>
        <Message
          v-if="!selectedPrompt.template.trim()"
          severity="warn"
          size="small"
          :closable="false"
        >
          Шаблон пустой — пока он пустой, используется стандартный промпт.
        </Message>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            v-if="!isActive(selectedPrompt.id)"
            label="Использовать"
            icon="pi pi-check"
            size="small"
            :disabled="!selectedPrompt.template.trim()"
            @click="library.setActive(selectedPrompt.id)"
          />
          <span
            v-else
            class="text-sm text-primary"
          ><i class="pi pi-check" /> Используется</span>
          <Button
            label="Дублировать"
            icon="pi pi-copy"
            size="small"
            severity="secondary"
            variant="text"
            @click="duplicateSelected"
          />
          <Button
            v-tooltip.top="'Заменить текст этого промпта стандартным'"
            label="Сбросить"
            icon="pi pi-replay"
            size="small"
            severity="secondary"
            variant="text"
            @click="update('template', defaultTemplate)"
          />
          <Button
            v-if="!deleteConfirm"
            class="ml-auto"
            label="Удалить"
            icon="pi pi-trash"
            size="small"
            severity="danger"
            variant="text"
            @click="deleteConfirm = true"
          />
          <template v-else>
            <Button
              class="ml-auto"
              label="Да, удалить"
              icon="pi pi-trash"
              size="small"
              severity="danger"
              @click="deleteSelected"
            />
            <Button
              label="Отмена"
              size="small"
              severity="secondary"
              variant="text"
              @click="deleteConfirm = false"
            />
          </template>
        </div>
      </div>
    </div>
  </Dialog>
</template>
