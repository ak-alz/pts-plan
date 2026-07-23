<script setup>
import {Button, MultiSelect} from 'primevue';

defineProps({
  filterState: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['select-group', 'select-highlight', 'reset']);

// Порог, с которого у MultiSelect включаются встроенный поиск и чекбокс "выбрать всё" —
// при малом числе опций они только мешают
const SEARCHABLE_OPTIONS_THRESHOLD = 5;

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
    />
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
    />
    <Button
      v-if="filterState.selectedGroupIds.length || filterState.selectedHighlightAttributes.length"
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
