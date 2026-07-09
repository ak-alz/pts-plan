<script setup>
import { Avatar, Badge, Button, Checkbox, MultiSelect, Select, Textarea } from 'primevue';
import { computed } from 'vue';

const props = defineProps({
  index: { type: Number, required: true },
  settings: { type: Object, required: true },
  users: { type: Array, required: true },
  stages: { type: Array, required: true },
  isOnlyRow: { type: Boolean, required: true },
  aiLoading: { type: Boolean, required: true },
});

const emit = defineEmits(['remove', 'copy-commit-change']);

const row = defineModel({ type: Object, required: true });

const responsibleUser = computed(() =>
  props.users.find((user) => user.id === row.value.responsibleId),
);

function onCopyContentChange() {
  if (row.value.copyContent) row.value.description = '';
}
</script>

<template>
  <div class="border border-surface-200 rounded-lg p-3 flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer border-0 bg-transparent p-0"
        @click="row._collapsed = !row._collapsed"
      >
        <span class="text-sm text-surface-400 font-medium shrink-0">#{{ index + 1 }}</span>
        <span class="text-sm font-medium truncate flex-1 min-w-0 max-w-[420px]">{{ row.title || 'Без названия' }}</span>
        <span
          v-if="responsibleUser"
          class="text-sm text-surface-400 truncate shrink-0"
        >{{ responsibleUser.title }}</span>
      </button>
      <Button
        :icon="`pi pi-chevron-${row._collapsed ? 'down' : 'up'}`"
        text
        rounded
        size="small"
        severity="secondary"
        @click="row._collapsed = !row._collapsed"
      />
      <Button
        icon="pi pi-times"
        text
        rounded
        size="small"
        severity="secondary"
        :disabled="isOnlyRow || aiLoading"
        @click="emit('remove')"
      />
    </div>

    <template v-if="!row._collapsed">
      <Textarea
        v-model="row.title"
        fluid
        rows="2"
        auto-resize
        placeholder="Название задачи"
      />

      <Textarea
        v-if="settings.description && !row.copyContent"
        v-model="row.description"
        fluid
        rows="2"
        auto-resize
        placeholder="Описание"
      />

      <div class="grid grid-cols-3 gap-2">
        <Select
          v-model="row.responsibleId"
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
          v-model="row.stageId"
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
          v-model="row.auditorIds"
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

      <div class="flex gap-4 flex-wrap">
        <div
          v-if="settings.showCommitCheckbox"
          class="flex gap-1 items-center"
        >
          <Checkbox
            v-model="row.copyCommit"
            binary
            :input-id="`card-copy-commit-${row._id}`"
            @change="emit('copy-commit-change')"
          />
          <label
            :for="`card-copy-commit-${row._id}`"
            class="text-sm cursor-pointer select-none"
          >Копировать текст коммита</label>
          <i
            v-tooltip.top="'После создания задач текст коммита для этой задачи будет скопирован в буфер обмена'"
            class="pi pi-question-circle"
          />
        </div>

        <div
          v-if="settings.description"
          class="flex gap-1 items-center"
        >
          <Checkbox
            v-model="row.copyContent"
            binary
            :input-id="`card-copy-content-${row._id}`"
            @change="onCopyContentChange"
          />
          <label
            :for="`card-copy-content-${row._id}`"
            class="text-sm cursor-pointer select-none"
          >Скопировать описание</label>
          <i
            v-tooltip.top="'Файловые вложения не копируются'"
            class="pi pi-question-circle"
          />
        </div>
      </div>
    </template>
  </div>
</template>
