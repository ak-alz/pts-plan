<script setup>
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {Button, DatePicker, InputMask, Popover} from 'primevue';
import {computed, ref, watch} from 'vue';

const props = defineProps({
  presets: {type: String, default: 'full'},
  minDate: {type: Date, default: null},
  maxDate: {type: Date, default: null},
  eventDates: {type: Array, default: () => []},
  disabled: {type: Boolean, default: false},
});

const model = defineModel({type: Array});

dayjs.extend(customParseFormat);

const monthLabel = {1: '1 месяц', 2: '2 месяца', 3: '3 месяца', 6: '6 месяцев', 12: '12 месяцев'};
const months = [1, 2, 3, 6, 12];
const monthPreset = (monthCount, type) => ({label: monthLabel[monthCount], months: monthCount, type});

const PRESET_GROUPS = {
  full: [
    {label: 'От сегодня', presets: months.map((monthCount) => monthPreset(monthCount, 'current'))},
    {label: 'Ранее', presets: months.map((monthCount) => monthPreset(monthCount, 'prev'))},
  ],
  current: [
    {
      label: 'От сегодня',
      presets: [
        {label: '1 неделя', weeks: 1, type: 'current'},
        {label: '2 недели', weeks: 2, type: 'current'},
        ...months.map((monthCount) => monthPreset(monthCount, 'current')),
      ],
    },
  ],
};

const presetGroups = computed(() => PRESET_GROUPS[props.presets] ?? PRESET_GROUPS.full);

const popoverRef = ref(null);
const localRange = ref(null);

function getPresetRange(preset) {
  if (preset.type === 'current') {
    const unit = preset.weeks ? 'week' : 'month';
    const amount = preset.weeks ?? preset.months;
    return [dayjs().subtract(amount, unit).toDate(), dayjs().toDate()];
  }
  const end = dayjs().subtract(preset.months, 'month');
  const start = end.subtract(preset.months, 'month');
  return [start.toDate(), end.toDate()];
}

function presetDateLabel(preset) {
  const [start, end] = getPresetRange(preset);
  return `${dayjs(start).format('DD.MM.YY')} – ${dayjs(end).format('DD.MM.YY')}`;
}

function isActivePreset(preset) {
  if (!model.value?.[0] || !model.value?.[1]) return false;
  const [presetStart, presetEnd] = getPresetRange(preset);
  return dayjs(model.value[0]).isSame(presetStart, 'day') && dayjs(model.value[1]).isSame(presetEnd, 'day');
}

function applyPreset(preset) {
  model.value = getPresetRange(preset);
  popoverRef.value?.hide();
}

const displayValue = computed(() => {
  if (!model.value?.[0]) return '';
  const start = dayjs(model.value[0]).format('DD.MM.YY');
  const end = model.value[1] ? dayjs(model.value[1]).format('DD.MM.YY') : '...';
  return `${start} – ${end}`;
});

const inputValue = ref(displayValue.value);

watch(displayValue, (value) => {
  inputValue.value = value;
});

function parseDate(value) {
  const parsed = dayjs(value.trim(), 'DD.MM.YY', true);
  return parsed.isValid() ? parsed.toDate() : null;
}

function applyInput() {
  const value = inputValue.value.trim();
  if (!value) {
    model.value = null;
    return;
  }
  const parts = value.split('–').map((part) => part.trim());
  if (parts.length === 2) {
    const start = parseDate(parts[0]);
    const end = parseDate(parts[1]);
    if (start && end) {
      model.value = [start, end];
      return;
    }
  }
  inputValue.value = displayValue.value;
}

const eventDateSet = computed(() => {
  const set = new Set();
  props.eventDates.forEach((eventDate) => {
    const day = dayjs(eventDate);
    set.add(`${day.year()}-${day.month()}-${day.date()}`);
  });
  return set;
});

function hasEvent(date) {
  return eventDateSet.value.has(`${date.year}-${date.month}-${date.day}`);
}

function openPopover(event) {
  if (props.disabled) return;
  localRange.value = model.value
    ? model.value.map((date) => (date instanceof Date ? date : (date ? new Date(date) : null)))
    : null;
  popoverRef.value?.show(event);
}

function onDateSelect(range) {
  localRange.value = range;
  if (range?.[0] && range?.[1]) {
    model.value = range;
    popoverRef.value?.hide();
  }
}
</script>

<template>
  <!-- p-inputwrapper — служебный класс PrimeVue: по нему InputGroup дотягивается до вложенного поля и
       убирает лишние скругления, иначе внутри группы стык с addon выглядел бы разорванным. flex здесь
       обязателен: правило `.p-inputgroup .p-inputtext { flex: 1 1 auto; width: 1% }` вложенное, поэтому
       достаёт и сам InputMask — в блочной обёртке он схлопнулся бы до 1% ширины, а во флекс-контейнере
       его растягивает flex-grow. Так же устроены собственные обёртки PrimeVue (.p-datepicker) -->
  <div class="w-full p-inputwrapper flex">
    <InputMask
      v-model="inputValue"
      mask="99.99.99 – 99.99.99"
      fluid
      size="small"
      placeholder="Выбрать"
      :disabled="disabled"
      @focus="openPopover"
      @blur="applyInput"
      @keydown.enter.prevent="applyInput"
      @keydown.escape="inputValue = displayValue"
    />
    <Popover ref="popoverRef">
      <div class="flex gap-0">
        <div class="flex flex-col gap-4 min-w-44 pr-4">
          <div
            v-for="group in presetGroups"
            :key="group.label"
          >
            <div
              v-if="presetGroups.length > 1"
              class="text-xs text-surface-400 dark:text-surface-500 mb-1.5 tracking-wide"
            >
              {{ group.label }}
            </div>
            <div class="flex flex-col gap-0.5">
              <Button
                v-for="preset in group.presets"
                :key="preset.label"
                size="small"
                severity="secondary"
                :variant="isActivePreset(preset) ? 'outlined' : 'text'"
                class="!justify-between"
                @click="applyPreset(preset)"
              >
                <span>{{ preset.label }}</span>
                <span class="text-xs text-surface-400 dark:text-surface-500 tabular-nums">{{ presetDateLabel(preset) }}</span>
              </Button>
            </div>
          </div>
        </div>
        <div class="border-l border-surface-200 dark:border-surface-700 pl-4">
          <DatePicker
            :model-value="localRange"
            :number-of-months="2"
            selection-mode="range"
            inline
            :min-date="minDate || undefined"
            :max-date="maxDate || undefined"
            :dt="{ panel: { border: { color: 'transparent' }, shadow: 'none', padding: '0' } }"
            @update:model-value="onDateSelect"
          >
            <template #date="{ date }">
              <span class="relative flex items-center justify-center w-full h-full">
                {{ date.day }}
                <span
                  v-if="hasEvent(date)"
                  class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-400"
                />
              </span>
            </template>
          </DatePicker>
        </div>
      </div>
    </Popover>
  </div>
</template>
