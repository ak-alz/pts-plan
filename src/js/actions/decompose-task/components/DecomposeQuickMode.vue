<script setup>
import { Avatar, Badge, Button, MultiSelect, Select, Textarea } from 'primevue';
import { computed } from 'vue';

import { pluralize } from '../../../utils.js';

defineProps({
  users: { type: Array, required: true },
  stages: { type: Array, required: true },
  isLoading: { type: Boolean, required: true },
});

const emit = defineEmits(['submit']);

const form = defineModel({ type: Object, required: true });

const parsedTitles = computed(() =>
  form.value.titlesText.split('\n').map((line) => line.trim()).filter(Boolean),
);

const taskCountHint = computed(() => {
  const count = parsedTitles.value.length;
  if (count < 2) return null;
  return `Будет создано ${count} ${pluralize(count, ['задача', 'задачи', 'задач'])}`;
});

function onSubmit() {
  if (parsedTitles.value.length === 0) return;
  emit('submit', parsedTitles.value.map((title) => ({
    title,
    description: '',
    copyContent: false,
    copyCommit: false,
    responsibleId: form.value.responsibleId,
    stageId: form.value.stageId,
    auditorIds: [...form.value.auditorIds],
  })));
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <Textarea
        v-model="form.titlesText"
        fluid
        rows="5"
        auto-resize
        placeholder="Каждая строка — отдельная задача"
        :disabled="isLoading"
      />
      <span
        v-if="taskCountHint"
        class="text-xs text-surface-400"
      >{{ taskCountHint }}</span>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <Select
        v-model="form.responsibleId"
        option-value="id"
        option-label="title"
        :options="users"
        filter
        filter-placeholder="Поиск"
        fluid
        placeholder="Исполнитель"
        size="small"
      >
        <template #option="{ option }">
          <div class="flex gap-2 items-center">
            <Avatar
              v-if="option.avatar"
              :image="option.avatar"
              shape="circle"
              size="small"
            />
            {{ option.title }}
          </div>
        </template>
      </Select>

      <Select
        v-model="form.stageId"
        option-value="id"
        option-label="title"
        :options="stages"
        fluid
        placeholder="Стадия"
        size="small"
      >
        <template #option="{ option }">
          <div class="flex gap-2 items-center">
            <Badge :style="`background-color: ${option.color};`" />
            {{ option.title }}
          </div>
        </template>
      </Select>

      <MultiSelect
        v-model="form.auditorIds"
        option-value="id"
        option-label="title"
        :options="users"
        filter
        filter-placeholder="Поиск"
        fluid
        :max-selected-labels="2"
        placeholder="Наблюдатели"
        size="small"
      >
        <template #option="{ option }">
          <Avatar
            v-if="option.avatar"
            :image="option.avatar"
            shape="circle"
            size="small"
          />
          {{ option.title }}
        </template>
      </MultiSelect>
    </div>

    <div>
      <Button
        label="Создать задачи"
        icon="pi pi-check"
        size="small"
        :loading="isLoading"
        :disabled="parsedTitles.length === 0"
        @click="onSubmit"
      />
    </div>
  </div>
</template>
