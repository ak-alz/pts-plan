<script setup>
import {Checkbox, RadioButton} from 'primevue';

const props = defineProps({
  step: {
    type: Object,
    required: true,
  },
  options: {
    type: Array,
    required: true,
  },
});

const model = defineModel({
  type: [String, Array],
});

function isSelected(option) {
  if (props.step.type === 'single') return model.value === option.value;
  return (model.value ?? []).includes(option.value);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <p class="m-0 text-base font-medium text-slate-800">
        {{ step.question }}
      </p>
      <p
        v-if="step.hint"
        class="m-0 mt-1 text-[13px] text-slate-500"
      >
        {{ step.hint }}
      </p>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <label
        v-for="option in options"
        :key="option.value"
        class="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors"
        :class="isSelected(option) ? 'border-primary bg-primary-50' : 'border-slate-200 hover:bg-slate-50'"
      >
        <RadioButton
          v-if="step.type === 'single'"
          v-model="model"
          :value="option.value"
          :name="step.id"
        />
        <Checkbox
          v-else
          v-model="model"
          :value="option.value"
        />
        <span class="flex flex-col gap-0.5">
          <span class="text-sm text-slate-700">{{ option.label }}</span>
          <span
            v-if="option.description"
            class="text-[12px] text-slate-400 leading-tight"
          >{{ option.description }}</span>
        </span>
      </label>
    </div>
  </div>
</template>
