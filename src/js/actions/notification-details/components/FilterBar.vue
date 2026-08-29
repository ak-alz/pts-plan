<script setup>
import {Avatar, Button, MultiSelect} from 'primevue';
import {computed} from 'vue';

import {pluralize} from '../../../utils.js';

const props = defineProps({
  filterState: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['select-group', 'select-highlight', 'select-author', 'reset']);

// Порог, с которого у MultiSelect включаются встроенный поиск и чекбокс "выбрать всё" —
// при малом числе опций они только мешают
const SEARCHABLE_OPTIONS_THRESHOLD = 5;

const hasActiveFilters = computed(() => props.filterState.selectedGroupIds.length
  || props.filterState.selectedHighlightAttributes.length
  || props.filterState.selectedAuthorNames.length);

const countsTooltip = computed(() => {
  const total = props.filterState.totalCount;
  const notificationsWord = pluralize(total, ['загруженного уведомления', 'загруженных уведомлений', 'загруженных уведомлений']);
  return `Фильтр показывает ${props.filterState.visibleCount} из ${total} ${notificationsWord}`;
});

</script>

<template>
  <div class="flex flex-1 min-w-0 flex-wrap items-center gap-1.5 pl-2 pr-2">
    <MultiSelect
      :model-value="filterState.selectedGroupIds"
      :options="filterState.groupOptions"
      option-label="label"
      option-value="value"
      placeholder="Все группы"
      size="small"
      append-to="self"
      show-clear
      :filter="filterState.groupOptions.length > SEARCHABLE_OPTIONS_THRESHOLD"
      filter-placeholder="Поиск"
      :show-toggle-all="filterState.groupOptions.length > SEARCHABLE_OPTIONS_THRESHOLD"
      class="min-w-0 max-w-[200px] flex-1"
      @update:model-value="emit('select-group', $event)"
    >
      <template #option="{ option }">
        <div class="flex gap-2 items-center">
          <span
            class="inline-block w-2 h-2 rounded-full flex-shrink-0"
            :style="`background-color: ${option.color};`"
          />
          {{ option.label }}
        </div>
      </template>
    </MultiSelect>
    <MultiSelect
      v-if="filterState.showHighlightSelect"
      :model-value="filterState.selectedHighlightAttributes"
      :options="filterState.highlightOptions"
      option-label="label"
      option-value="value"
      placeholder="Все типы"
      size="small"
      append-to="self"
      show-clear
      :filter="filterState.highlightOptions.length > SEARCHABLE_OPTIONS_THRESHOLD"
      filter-placeholder="Поиск"
      :show-toggle-all="filterState.highlightOptions.length > SEARCHABLE_OPTIONS_THRESHOLD"
      class="min-w-0 max-w-[200px] flex-1"
      @update:model-value="emit('select-highlight', $event)"
    >
      <template #option="{ option }">
        <div class="flex gap-2 items-center">
          <i
            :class="['pi', option.icon, 'text-sm']"
            :style="`color: ${option.color};`"
          />
          {{ option.label }}
        </div>
      </template>
    </MultiSelect>
    <MultiSelect
      :model-value="filterState.selectedAuthorNames"
      :options="filterState.authorOptions"
      option-label="label"
      option-value="value"
      placeholder="Все авторы"
      size="small"
      append-to="self"
      show-clear
      :filter="filterState.authorOptions.length > SEARCHABLE_OPTIONS_THRESHOLD"
      filter-placeholder="Поиск"
      :show-toggle-all="filterState.authorOptions.length > SEARCHABLE_OPTIONS_THRESHOLD"
      class="min-w-0 max-w-[200px] flex-1"
      @update:model-value="emit('select-author', $event)"
    >
      <template #option="{ option }">
        <div class="flex gap-2 items-center">
          <Avatar
            v-if="option.avatar"
            :image="option.avatar"
            shape="circle"
          />
          {{ option.label }}
        </div>
      </template>
    </MultiSelect>
    <span
      v-if="hasActiveFilters"
      v-tooltip="countsTooltip"
      class="text-xs text-surface-500 dark:text-surface-400 whitespace-nowrap flex-shrink-0 cursor-default"
    >
      ({{ filterState.visibleCount }}/{{ filterState.totalCount }})
    </span>
    <Button
      v-if="hasActiveFilters"
      v-tooltip="'Сбросить фильтры'"
      type="button"
      icon="pi pi-filter-slash"
      severity="secondary"
      text
      rounded
      size="small"
      @click="emit('reset')"
    />
  </div>
</template>
