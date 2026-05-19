<script setup>
import dayjs from 'dayjs';
import {Button, DatePicker, InputText, Popover} from 'primevue';
import {computed, ref} from 'vue';

const model = defineModel({type: Array});

const popoverRef = ref(null);
const localRange = ref(null);

const durations = [1, 2, 3, 6, 12];

const durationLabel = {1: '1 месяц', 2: '2 месяца', 3: '3 месяца', 6: '6 месяцев', 12: '12 месяцев'};

const presetGroups = [
  {
    label: 'Текущий',
    presets: durations.map((months) => ({label: durationLabel[months], months, type: 'current'})),
  },
  {
    label: 'Предыдущий',
    presets: durations.map((months) => ({label: durationLabel[months], months, type: 'prev'})),
  },
];

function getPresetRange(preset) {
  if (preset.type === 'current') {
    return [dayjs().subtract(preset.months, 'month').toDate(), dayjs().toDate()];
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

function openPopover(event) {
  localRange.value = model.value ? [...model.value] : null;
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
    <InputText
      :value="displayValue"
      readonly
      size="small"
      class="w-full cursor-pointer"
      @click="openPopover"
    />
    <Popover ref="popoverRef">
      <div class="flex gap-4">
        <div class="flex flex-col gap-4 min-w-44">
          <div
            v-for="group in presetGroups"
            :key="group.label"
          >
            <div class="text-xs text-surface-400 mb-1.5 tracking-wide">
              {{ group.label }}
            </div>
            <div class="flex flex-col gap-0.5">
              <Button
                v-for="preset in group.presets"
                :key="preset.label + preset.type"
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
        <DatePicker
          :model-value="localRange"
          :number-of-months="2"
          selection-mode="range"
          inline
          @update:model-value="onDateSelect"
        />
      </div>
    </Popover>
  </div>
</template>
