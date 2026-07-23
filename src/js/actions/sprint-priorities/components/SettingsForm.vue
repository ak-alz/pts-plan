<script setup>
import { Avatar, Button, InputNumber, InputText, MultiSelect, ToggleSwitch } from 'primevue';
import { reactive, ref, toRaw } from 'vue';

import { showToast } from '../../../toastHost/showToast.js';
import FormField from '../../../ui/FormField.vue';

const props = defineProps({
  initial: {
    type: Object,
    default() {
      return {};
    },
  },
  settingsStorageKey: {
    type: String,
    required: true,
  },
  allColumns: {
    type: Array,
    required: true,
  },
  defaultHiddenColumns: {
    type: Array,
    required: true,
  },
  groupUsers: {
    type: Array,
    default() {
      return [];
    },
  },
  groupStages: {
    type: Array,
    default() {
      return [];
    },
  },
});

const emit = defineEmits(['success']);

const isLoading = ref(false);

const defaultVisibleColumns = props.allColumns
  .map((c) => c.key)
  .filter((k) => !props.defaultHiddenColumns.includes(k));

const form = reactive({
  sheetUrl: props.initial.sheetUrl ?? '',
  autoDetectColumn: props.initial.autoDetectColumn ?? true,
  taskColumnIndex: props.initial.taskColumnIndex ?? 1,
  hasHeaders: props.initial.hasHeaders ?? true,
  visibleColumns: props.initial.visibleColumns
    ? toRaw(props.initial.visibleColumns)
    : [...defaultVisibleColumns],
  defaultStageFilter: props.initial.defaultStageFilter
    ? toRaw(props.initial.defaultStageFilter)
    : [],
  showTeamPoints: props.initial.showTeamPoints ?? true,
  showRowMarker: props.initial.showRowMarker ?? true,
  teamUsers: props.initial.teamUsers ? toRaw(props.initial.teamUsers) : [],
  teamStages: props.initial.teamStages ? toRaw(props.initial.teamStages) : [],
});

async function saveSettings() {
  if (!form.sheetUrl.trim()) {
    showToast({
      severity: 'warn',
      summary: 'Заполните поля',
      detail: 'Укажите ссылку на Google Таблицу.',
      life: 4000,
    });
    return;
  }

  isLoading.value = true;

  try {
    await chrome.storage.local.set({
      [props.settingsStorageKey]: toRaw(form),
    });

    showToast({
      severity: 'success',
      summary: 'Сохранено',
      detail: 'Настройки успешно сохранены.',
      life: 3000,
    });

    emit('success');
  } catch (error) {
    console.warn(error);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form
    class="min-w-[600px]"
    @submit.prevent="saveSettings"
  >
    <div class="grid grid-cols-2 gap-3">
      <FormField
        id="settings_sheet_url"
        label="Ссылка на Google Таблицу"
        tip="Ссылка на таблицу с приоритетами задач. Таблица должна быть доступна по ссылке (режим «Просматривать»)."
        class="col-span-2"
      >
        <InputText
          v-model="form.sheetUrl"
          fluid
          input-id="settings_sheet_url"
          placeholder="https://docs.google.com/spreadsheets/d/..."
        />
      </FormField>

      <FormField
        id="settings_auto_detect_column"
        label="Определять колонку автоматически"
        tip="Автоматически находит колонку, содержащую ссылки на задачи Bitrix24, по первым строкам таблицы."
      >
        <ToggleSwitch
          v-model="form.autoDetectColumn"
          input-id="settings_auto_detect_column"
        />
      </FormField>

      <FormField
        id="settings_has_headers"
        label="Первая строка — заголовки"
        tip="Если включено, первая строка таблицы считается заголовком и пропускается."
      >
        <ToggleSwitch
          v-model="form.hasHeaders"
          input-id="settings_has_headers"
        />
      </FormField>

      <FormField
        v-if="!form.autoDetectColumn"
        id="settings_task_column_index"
        label="Номер колонки со ссылкой на задачу"
        tip="Порядковый номер колонки (начиная с 1), в которой находятся ссылки на задачи Bitrix24."
      >
        <InputNumber
          v-model="form.taskColumnIndex"
          :max-fraction-digits="0"
          :min="1"
          :use-grouping="false"
          fluid
          input-id="settings_task_column_index"
        />
      </FormField>

      <FormField
        id="settings_visible_columns"
        label="Видимые колонки"
        tip="Выберите, какие колонки отображать в таблице."
      >
        <MultiSelect
          v-model="form.visibleColumns"
          :options="allColumns"
          option-label="label"
          option-value="key"
          placeholder="Выбрать колонки"
          fluid
          input-id="settings_visible_columns"
        />
      </FormField>

      <FormField
        id="settings_default_stage_filter"
        label="Колонки по умолчанию"
        tip="Фильтр по колонкам, применяемый при каждом открытии виджета."
      >
        <MultiSelect
          v-model="form.defaultStageFilter"
          :options="groupStages"
          option-label="name"
          option-value="name"
          filter
          filter-placeholder="Поиск"
          placeholder="Без фильтра"
          :max-selected-labels="2"
          fluid
          input-id="settings_default_stage_filter"
        >
          <template #option="{ option }">
            <div class="flex items-center gap-2">
              <span
                v-if="option.color"
                class="inline-block w-2 h-2 rounded-full flex-shrink-0"
                :style="`background-color: ${option.color}`"
              />
              <span>{{ option.name }}</span>
            </div>
          </template>
        </MultiSelect>
      </FormField>

      <FormField
        id="settings_show_row_marker"
        label="Показывать флажок"
        tip="Добавляет колонку с флажком для отметки текущей позиции при командном разборе списка."
      >
        <ToggleSwitch
          v-model="form.showRowMarker"
          input-id="settings_show_row_marker"
        />
      </FormField>

      <div class="col-span-2 border-t border-surface-200" />

      <FormField
        id="settings_show_team_points"
        label="Показывать баллы команды"
        tip="Выводит таблицу с суммой story points по исполнителям над списком приоритетов."
        class="col-span-2"
      >
        <ToggleSwitch
          v-model="form.showTeamPoints"
          input-id="settings_show_team_points"
        />
      </FormField>

      <template v-if="form.showTeamPoints">
        <FormField
          id="settings_team_users"
          label="Участники"
          tip="Исполнители, для которых считать баллы. Если не выбраны — считаются все."
        >
          <MultiSelect
            v-model="form.teamUsers"
            :options="groupUsers"
            option-label="name"
            option-value="id"
            filter
            filter-placeholder="Поиск"
            placeholder="Все участники"
            :max-selected-labels="2"
            fluid
            input-id="settings_team_users"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <Avatar
                  v-if="option.photo"
                  :image="option.photo"
                  shape="circle"
                />
                <span>{{ option.name }}</span>
              </div>
            </template>
          </MultiSelect>
        </FormField>

        <FormField
          id="settings_team_stages"
          label="Колонки для подсчёта"
          tip="Задачи в выбранных колонках суммируются для каждого исполнителя."
        >
          <MultiSelect
            v-model="form.teamStages"
            :options="groupStages"
            option-label="name"
            option-value="id"
            filter
            filter-placeholder="Поиск"
            placeholder="Выбрать колонки"
            :max-selected-labels="2"
            fluid
            input-id="settings_team_stages"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <span
                  v-if="option.color"
                  class="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  :style="`background-color: ${option.color}`"
                />
                <span>{{ option.name }}</span>
              </div>
            </template>
          </MultiSelect>
        </FormField>
      </template>
    </div>

    <div class="mt-3">
      <Button
        size="small"
        type="submit"
        label="Сохранить"
        :loading="isLoading"
      />
    </div>
  </form>
</template>
