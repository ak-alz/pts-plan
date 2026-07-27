<script setup>
import dayjs from 'dayjs';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
  Avatar,
  Badge,
  Button,
  Checkbox,
  DatePicker,
  InputNumber,
  InputText,
  MultiSelect,
  Select,
} from 'primevue';
import {computed, reactive, ref, toRaw} from 'vue';

import {showToast} from '../../../toastHost/showToast.js';
import FormField from '../../../ui/FormField.vue';
import {CUT_OPTIONS, DEFAULT_SETTINGS, TAB_OPTIONS} from '../variables.js';

const props = defineProps({
  stages: {
    type: Array,
    default: () => [],
  },
  users: {
    type: Array,
    default: () => [],
  },
  initial: {
    type: Object,
    default: () => ({}),
  },
  settingsStorageKey: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['success']);

const isLoading = ref(false);

const monthOptions = [
  {label: '1 месяц', value: 1},
  {label: '3 месяца', value: 3},
  {label: '6 месяцев', value: 6},
  {label: '12 месяцев', value: 12},
];

const separatorOptions = [
  {label: 'Tab', value: '\t'},
  {label: 'Точка с запятой (;)', value: ';'},
  {label: 'Запятая (,)', value: ','},
];

const stageOptions = computed(() => props.stages.map((stage) => ({
  id: String(stage.ID),
  name: stage.TITLE,
  color: `#${stage.COLOR}`,
})));

// Первая колонка канбана (SYSTEM_TYPE: NEW) есть в любой группе и почти всегда и есть бэклог —
// разумный дефолт, пока пользователь не разметил колонки сам
const defaultBacklogStageIds = computed(() => props.stages
  .filter((stage) => stage.SYSTEM_TYPE === 'NEW')
  .map((stage) => String(stage.ID)));

const form = reactive({
  backlogStageIds: props.initial.backlogStageIds?.length ? toRaw(props.initial.backlogStageIds) : defaultBacklogStageIds.value,
  excludedStageIds: props.initial.excludedStageIds ? toRaw(props.initial.excludedStageIds) : [],
  contributionThresholdPercent: props.initial.contributionThresholdPercent ?? DEFAULT_SETTINGS.contributionThresholdPercent,
  excludedUserIds: props.initial.excludedUserIds ? toRaw(props.initial.excludedUserIds) : [],
  defaultMonths: props.initial.defaultMonths ?? DEFAULT_SETTINGS.defaultMonths,
  defaultCut: props.initial.defaultCut ?? DEFAULT_SETTINGS.defaultCut,
  defaultCompareEnabled: props.initial.defaultCompareEnabled ?? DEFAULT_SETTINGS.defaultCompareEnabled,
  defaultTab: props.initial.defaultTab ?? DEFAULT_SETTINGS.defaultTab,
  copySeparator: props.initial.copySeparator ?? DEFAULT_SETTINGS.copySeparator,
  csvSeparator: props.initial.csvSeparator ?? DEFAULT_SETTINGS.csvSeparator,
});

const milestoneRows = ref((props.initial.milestones ?? []).map((milestone) => ({
  date: milestone.date ? dayjs(milestone.date).toDate() : null,
  label: milestone.label ?? '',
})));

function addMilestone() {
  milestoneRows.value.push({date: null, label: ''});
}

function removeMilestone(index) {
  milestoneRows.value.splice(index, 1);
}

async function saveSettings() {
  isLoading.value = true;
  try {
    // Даты событий храним строками: chrome.storage не сериализует Date — объект вернулся бы пустым
    const milestones = milestoneRows.value
      .filter((row) => row.date)
      .map((row) => ({date: dayjs(row.date).format('YYYY-MM-DD'), label: row.label.trim()}))
      .sort((a, b) => a.date.localeCompare(b.date));

    const settings = {...toRaw(form), milestones};
    await chrome.storage.local.set({[props.settingsStorageKey]: settings});
    showToast({
      severity: 'success',
      summary: 'Сохранено',
      detail: 'Настройки успешно сохранены.',
      life: 5000,
    });
    emit('success', settings);
  } catch (e) {
    console.warn(e);
    showToast({severity: 'error', summary: 'Ошибка', detail: e.message, life: 5000});
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form
    class="flex flex-col gap-4 w-[640px]"
    @submit.prevent="saveSettings"
  >
    <div class="grid grid-cols-2 gap-x-2 gap-y-3">
      <FormField
        label="Колонки с планами"
        tip="Колонки, где задачи ждут своей очереди. По ним считается, сколько задача проводит в планах, и блок «сейчас». По умолчанию — первая колонка канбана."
      >
        <MultiSelect
          v-model="form.backlogStageIds"
          :options="stageOptions"
          option-label="name"
          option-value="id"
          placeholder="Выбрать"
          :max-selected-labels="2"
          filter
          filter-placeholder="Поиск"
          fluid
          size="small"
        >
          <template #option="{option}">
            <Badge :style="`background-color: ${option.color};`" />
            {{ option.name }}
          </template>
        </MultiSelect>
      </FormField>

      <FormField
        label="Исключить колонки из расчётов"
        tip="Архивные свалки: задачи в них никуда не двигаются и маскируют реальную очередь. Из планов и из «взято в спринт» они убираются, показываются отдельно."
      >
        <MultiSelect
          v-model="form.excludedStageIds"
          :options="stageOptions"
          option-label="name"
          option-value="id"
          placeholder="Ничего не исключать"
          :max-selected-labels="2"
          filter
          filter-placeholder="Поиск"
          fluid
          size="small"
        >
          <template #option="{option}">
            <Badge :style="`background-color: ${option.color};`" />
            {{ option.name }}
          </template>
        </MultiSelect>
      </FormField>

      <FormField
        label="Порог вклада исполнителя, % баллов"
        tip="Исполнители, давшие меньше этой доли баллов периода, в состав команды не входят — так разовые исполнители не завышают её размер. Ноль — не фильтровать."
      >
        <InputNumber
          v-model="form.contributionThresholdPercent"
          :min="0"
          :max="50"
          :max-fraction-digits="1"
          show-buttons
          fluid
          size="small"
        />
      </FormField>

      <FormField
        label="Не учитывать исполнителей"
        tip="Их задачи и баллы не попадают ни в состав команды, ни в «баллов на человека». В общий объём работы по-прежнему входят."
      >
        <MultiSelect
          v-model="form.excludedUserIds"
          :options="users"
          option-label="name"
          option-value="id"
          placeholder="Учитывать всех"
          :max-selected-labels="2"
          filter
          filter-placeholder="Поиск"
          fluid
          size="small"
        >
          <template #option="{option}">
            <div class="flex gap-2 items-center">
              <Avatar
                v-if="option.photo"
                :image="option.photo"
                shape="circle"
                size="small"
              />
              {{ option.name }}
            </div>
          </template>
        </MultiSelect>
      </FormField>
    </div>

    <div>
      <FormField
        label="События"
        tip="Даты изменений в процессе: найм, смена подхода, внедрение инструментов. Каждое событие рисуется вертикальной линией на всех графиках, а по выбранному считается сводка «до и после»."
      >
        <div class="flex flex-col gap-2">
          <div
            v-for="(milestone, index) in milestoneRows"
            :key="index"
            class="flex gap-2 items-center"
          >
            <DatePicker
              v-model="milestone.date"
              date-format="dd.mm.yy"
              show-icon
              icon-display="input"
              size="small"
              placeholder="Дата"
              class="w-[160px]"
            />
            <InputText
              v-model="milestone.label"
              size="small"
              placeholder="Что произошло"
              class="flex-1"
            />
            <Button
              v-tooltip="'Удалить событие'"
              size="small"
              severity="danger"
              variant="text"
              icon="pi pi-trash"
              type="button"
              @click="removeMilestone(index)"
            />
          </div>
          <Button
            size="small"
            severity="secondary"
            variant="text"
            icon="pi pi-plus"
            label="Добавить событие"
            type="button"
            class="self-start"
            @click="addMilestone"
          />
        </div>
      </FormField>
    </div>

    <Accordion
      :dt="{
        headerPadding: '10px 0',
        contentPadding: '10px 0',
      }"
    >
      <AccordionPanel value="additional">
        <AccordionHeader>
          Дополнительные настройки
        </AccordionHeader>
        <AccordionContent>
          <div class="grid grid-cols-2 gap-x-2 gap-y-3">
            <FormField label="Период по умолчанию">
              <Select
                v-model="form.defaultMonths"
                :options="monthOptions"
                option-label="label"
                option-value="value"
                fluid
                size="small"
              />
            </FormField>

            <FormField
              label="Разрез по умолчанию"
              tip="Разрез общий для всех вкладок, кроме «Качества»: она всегда считается по всем задачам."
            >
              <Select
                v-model="form.defaultCut"
                :options="CUT_OPTIONS"
                option-label="label"
                option-value="value"
                fluid
                size="small"
              />
            </FormField>

            <FormField label="Вкладка по умолчанию">
              <Select
                v-model="form.defaultTab"
                :options="TAB_OPTIONS"
                option-label="label"
                option-value="value"
                fluid
                size="small"
              />
            </FormField>

            <div class="flex gap-2 items-center self-end pb-2">
              <Checkbox
                v-model="form.defaultCompareEnabled"
                binary
                input-id="task-dynamics-default-compare"
              />
              <label
                for="task-dynamics-default-compare"
                class="text-sm cursor-pointer"
              >
                Сравнивать с предыдущим периодом
                <i
                  v-tooltip="'Состояние галки у поля «Сравнить с» при открытии виджета. Выключенное сравнение вдвое сокращает объём загрузки.'"
                  class="pi pi-question-circle text-surface-400 dark:text-surface-500"
                />
              </label>
            </div>

            <FormField label="Разделитель копирования">
              <Select
                v-model="form.copySeparator"
                :options="separatorOptions"
                option-label="label"
                option-value="value"
                fluid
                size="small"
              />
            </FormField>

            <FormField label="Разделитель CSV">
              <Select
                v-model="form.csvSeparator"
                :options="separatorOptions"
                option-label="label"
                option-value="value"
                fluid
                size="small"
              />
            </FormField>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <Button
      size="small"
      type="submit"
      label="Сохранить"
      class="self-start"
      :loading="isLoading"
    />
  </form>
</template>
