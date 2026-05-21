<script setup>
import {Button, Checkbox, InputGroup, InputNumber, InputText, RadioButton, Select} from 'primevue';
import {computed, ref, watch} from 'vue';

import allOptions, {optionTypes} from '../../js/options.js';
import {useAutoFill} from '../useAutoFill.js';
import ColorPicker from './ColorPicker.vue';
import CommentDemo from './CommentDemo.vue';
import NotificationDemo from './NotificationDemo.vue';

const props = defineProps({
  level: {
    type: Number,
    default: 0,
  },
  options: {
    type: Array,
    default() {
      return [];
    },
  },
});

const model = defineModel({
  type: Object,
  required: true,
});

const profileKeys = new Set(allOptions.filter(opt => opt.groups?.includes('profile')).map(opt => opt.key));
const {autoFill, isFetching: autoFillFetching, fetchError: autoFillError} = useAutoFill(model);

const style = computed(() => {
  if (!props.level) return null;

  return `padding-left: calc(${props.level * 20}px + var(--spacing));`;
});

function flattenOptions(opts) {
  const map = {};
  for (const opt of opts) {
    map[opt.key] = opt;
    if (opt.options) Object.assign(map, flattenOptions(opt.options));
  }
  return map;
}

const optionMap = flattenOptions(allOptions);

function missingNeeds(option) {
  if (!option.needs) return [];
  return option.needs
    .filter((k) => !model.value[k])
    .map((k) => optionMap[k])
    .filter(Boolean);
}

const topLevelMissingNeeds = ref([]);

watch(
  () => props.options,
  (opts) => {
    const seen = new Set();
    const result = [];
    for (const option of opts) {
      for (const needed of missingNeeds(option)) {
        if (!seen.has(needed.key)) {
          seen.add(needed.key);
          result.push(needed);
        }
      }
    }
    topLevelMissingNeeds.value = result;
  },
  { immediate: true },
);
</script>

<template>
  <OptionsTree
    v-if="topLevelMissingNeeds.length"
    v-model="model"
    :level="level"
    :options="topLevelMissingNeeds"
  />
  <div
    v-for="option in options"
    :key="option.key"
    class="flex gap-1 flex-col"
    :style
  >
    <div
      v-if="option.type === optionTypes.RADIO"
      class="flex gap-2 flex-col"
    >
      <div
        v-for="choice in option.choices"
        :key="choice.value"
        class="flex gap-1 items-center"
      >
        <RadioButton
          v-model="model[option.key]"
          :input-id="`option_${option.key}_${choice.value}`"
          :value="choice.value"
          size="small"
        />
        <label
          class="cursor-pointer"
          :for="`option_${option.key}_${choice.value}`"
        >{{ choice.label }}</label>
      </div>
    </div>
    <div
      v-else
      class="flex gap-1 items-center"
    >
      <InputGroup
        v-if="option.type === optionTypes.TEXT || option.type === optionTypes.NUMBER"
        :pt="{root: {style: {width: 'auto'}}}"
      >
        <InputText
          v-if="option.type === optionTypes.TEXT"
          :id="`option_${option.key}`"
          v-model="model[option.key]"
          :style="{ width: option.width ?? '180px' }"
          size="small"
          :disabled="option.needs?.some(k => !model[k])"
        />
        <InputNumber
          v-else-if="option.type === optionTypes.NUMBER"
          v-model="model[option.key]"
          :input-style="{ width: option.width ?? '180px' }"
          :input-id="`option_${option.key}`"
          size="small"
          :use-grouping="false"
          :max-fraction-digits="0"
          :disabled="option.needs?.some(k => !model[k])"
        />
        <Button
          v-if="profileKeys.has(option.key)"
          v-tooltip.bottom="autoFillError ? 'Не удалось получить данные' : 'Заполнить автоматически'"
          icon="pi pi-download"
          size="small"
          severity="secondary"
          :loading="autoFillFetching"
          @click="autoFill"
        />
      </InputGroup>
      <ColorPicker
        v-else-if="option.type === optionTypes.COLOR"
        :id="`option_${option.key}`"
        v-model="model[option.key]"
        :preset-colors="option.presets || []"
      >
        <template
          v-if="option.demo"
          #after
        >
          <NotificationDemo
            v-if="String(option.demo).startsWith('notification-')"
            class="mt-3"
            :options="model"
            :highlight="String(option.demo).replace('notification-', '')"
          />
          <CommentDemo
            v-else
            class="mt-3"
            :options="model"
            :new="option.demo === 'comment-new'"
            :quote="option.demo === 'comment-quote'"
          />
        </template>
      </ColorPicker>
      <Select
        v-else-if="option.type === optionTypes.SELECT"
        v-model="model[option.key]"
        :options="option.choices"
        option-label="label"
        option-value="value"
        size="small"
        fluid
        :style="{ width: option.width ?? '180px' }"
      />
      <Checkbox
        v-else
        v-model="model[option.key]"
        binary
        :input-id="`option_${option.key}`"
        :disabled="option.needs?.some(k => !model[k])"
      />
      <label
        class="cursor-pointer shrink-0"
        :for="`option_${option.key}`"
      >{{ option.name }}</label>
      <span
        v-if="option.new"
        class="text-[10px] leading-none border border-current rounded px-1 py-0.5 text-surface-500"
      >new</span>
      <i
        v-if="option.tip"
        v-tooltip.bottom="option.tip"
        class="pi pi-question-circle text-surface-500"
      />
    </div>
    <OptionsTree
      v-if="option.options && model[option.key]"
      v-model="model"
      :level="level + 1"
      :options="option.options"
    />
  </div>
</template>

<style scoped>

</style>
