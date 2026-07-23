<script setup>
import { Button } from 'primevue';

defineEmits(['open']);
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-3">
    <p class="m-0 text-[13px] font-medium text-surface-700 dark:text-surface-0">
      Быстрая настройка
    </p>
    <p class="m-0 text-[12px] text-surface-500 dark:text-surface-400 leading-snug">
      Ответьте на пару вопросов — подходящие функции появятся за минуту.
    </p>
    <Button
      label="Настроить"
      size="small"
      fluid
      @click="$emit('open')"
    />
  </div>
</template>
