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
});

const model = defineModel({type: Array});

dayjs.extend(customParseFormat);

const monthLabel = {1: '1 месяц', 2: '2 месяца', 3: '3 месяца', 6: '6 месяцев', 12: '12 месяцев'};
const months = [1, 2, 3, 6, 12];

const PRESET_GROUPS = {
  full: [
    {label: 'Текущий', presets: months.map((m) => ({label: monthLabel[m], months: m, type: 'current'}))},
    {label: 'Предыдущий', presets: months.map((m) => ({label: monthLabel[m], months: m, type: 'prev'}))},
  ],
  current: [
    {
      label: 'Текущий',
      presets: [
        {label: '1 неделя', weeks: 1, type: 'current'},
        {label: '2 недели', weeks: 2, type: 'current'},
        ...months.map((m) => ({label: monthLabel[m], months: m, type: 'current'})),
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
  const [s, e] = getPresetRange(preset);
  return `${dayjs(s).format('DD.MM.YY')} – ${dayjs(e).format('DD.MM.YY')}`;
}

function isActivePreset(preset) {
  if (!model.value?.[0] || !model.value?.[1]) return false;
  const [ps, pe] = getPresetRange(preset);
  return dayjs(model.value[0]).isSame(ps, 'day') && dayjs(model.value[1]).isSame(pe, 'day');
}

function applyPreset(preset) {
  model.value = getPresetRange(preset);
  popoverRef.value?.hide();
}

const displayValue = computed(() => {
  if (!model.value?.[0]) return '';
  const s = dayjs(model.value[0]).format('DD.MM.YY');
  const e = model.value[1] ? dayjs(model.value[1]).format('DD.MM.YY') : '...';
  return `${s} – ${e}`;
});

const inputValue = ref(displayValue.value);

watch(displayValue, (val) => {
  inputValue.value = val;
});

function parseDate(str) {
  const d = dayjs(str.trim(), 'DD.MM.YY', true);
  return d.isValid() ? d.toDate() : null;
}

function applyInput() {
  const val = inputValue.value.trim();
  if (!val) {
    model.value = null;
    return;
  }
  const parts = val.split('–').map((s) => s.trim());
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
  props.eventDates.forEach((d) => {
    const day = dayjs(d);
    set.add(`${day.year()}-${day.month()}-${day.date()}`);
  });
  return set;
});

function hasEvent(date) {
  return eventDateSet.value.has(`${date.year}-${date.month}-${date.day}`);
}

function openPopover(event) {
  localRange.value = model.value
    ? model.value.map((d) => (d instanceof Date ? d : (d ? new Date(d) : null)))
    : null;
  popoverRef.value?.show(event);
}

function onDateSelect(val) {
  localRange.value = val;
  if (val?.[0] && val?.[1]) {
    model.value = val;
    popoverRef.value?.hide();
  }
}
</script>

<template>
  <div class="w-full">
    <InputMask
      v-model="inputValue"
      mask="99.99.99 – 99.99.99"
      fluid
      size="small"
      placeholder="Выбрать"
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
              class="text-xs text-surface-400 mb-1.5 tracking-wide"
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
                <span class="text-xs text-surface-400 tabular-nums">{{ presetDateLabel(preset) }}</span>
              </Button>
            </div>
          </div>
        </div>
        <div class="border-l border-surface-200 pl-4">
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
              <span class="flex flex-col items-center leading-none gap-0.5">
                {{ date.day }}
                <span
                  class="w-1 h-1 rounded-full"
                  :class="hasEvent(date) ? 'bg-primary-400' : ''"
                />
              </span>
            </template>
          </DatePicker>
        </div>
      </div>
    </Popover>
  </div>
</template>
