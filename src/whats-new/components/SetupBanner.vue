<script setup>
import { Button } from 'primevue';

defineEmits(['open']);
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p class="m-0 text-[13px] font-medium text-slate-700">
      Быстрая настройка
    </p>
    <p class="m-0 text-[12px] text-slate-500 leading-snug">
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
