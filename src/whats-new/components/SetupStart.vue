<script setup>
import {RadioButton} from 'primevue';

const mode = defineModel({
  type: String,
});

const modes = [
  {
    value: 'sequential',
    label: 'После каждого вопроса',
    description: 'После каждого вопроса сразу появятся подходящие функции — можно включать по ходу.',
  },
  {
    value: 'end',
    label: 'Показать всё в конце',
    description: 'Ответите на все вопросы, а подобранные функции появятся единым списком в конце.',
  },
];
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <p class="m-0 text-base font-medium text-surface-800 dark:text-surface-0">
        Подбор функций под вас
      </p>
      <p class="m-0 mt-1 text-[13px] text-surface-500 dark:text-surface-400">
        Ответьте на пару вопросов — появятся подходящие функции. Выберите, когда их показывать.
      </p>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <label
        v-for="option in modes"
        :key="option.value"
        class="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors"
        :class="mode === option.value ? 'border-primary bg-primary-50 dark:bg-primary-900/40' : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'"
      >
        <RadioButton
          v-model="mode"
          :value="option.value"
          name="setup-mode"
        />
        <span class="flex flex-col gap-0.5">
          <span class="text-sm text-surface-700 dark:text-surface-0">{{ option.label }}</span>
          <span class="text-[12px] text-surface-400 dark:text-surface-500 leading-tight">{{ option.description }}</span>
        </span>
      </label>
    </div>
  </div>
</template>
