<script setup>
import { Checkbox, InputNumber, InputText, RadioButton, Select } from 'primevue';
import { computed } from 'vue';

import { optionTypes } from '../../js/options.js';
import ColorPicker from './ColorPicker.vue';
import CrmComment from './CrmComment.vue';

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

const style = computed(() => {
  if (!props.level) return null;

  return `padding-left: calc(${props.level * 20}px + var(--spacing));`;
});
</script>

<template>
  <div
    v-for="option in options"
    :key="option.key"
    class="flex gap-1 flex-col"
    :style
  >
    <div
      v-if="option.type === optionTypes.RADIO"
      class="flex gap-2 flex-wrap"
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
      <InputText
        v-if="option.type === optionTypes.TEXT"
        :id="`option_${option.key}`"
        v-model="model[option.key]"
        :style="{ width: option.width ?? '180px' }"
        size="small"
        :disabled="typeof option.disabled === 'function' ? option.disabled(model) : !!option.disabled"
      />
      <InputNumber
        v-else-if="option.type === optionTypes.NUMBER"
        v-model="model[option.key]"
        :input-style="{ width: option.width ?? '180px' }"
        :input-id="`option_${option.key}`"
        size="small"
        :use-grouping="false"
        :max-fraction-digits="0"
        :disabled="typeof option.disabled === 'function' ? option.disabled(model) : !!option.disabled"
      />
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
          <CrmComment
            class="mt-3"
            :options="model"
            :new="option.key === 'newCommentColorBackground'"
            :quote="['quoteColorBackground', 'quoteColorBorder'].includes(option.key)"
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
      />
      <Checkbox
        v-else
        v-model="model[option.key]"
        binary
        :input-id="`option_${option.key}`"
        :disabled="typeof option.disabled === 'function' ? option.disabled(model) : !!option.disabled"
      />
      <label
        class="cursor-pointer shrink-0"
        :for="`option_${option.key}`"
      >{{ option.name }}</label>
      <i
        v-if="option.new"
        v-tooltip.bottom="'Новое'"
        class="pi pi-sparkles"
      />
      <i
        v-if="option.tip"
        v-tooltip.bottom="option.tip"
        class="pi pi-question-circle"
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
