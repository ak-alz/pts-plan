<script setup>
import { Checkbox } from 'primevue';

defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
});

const model = defineModel({ type: Object, required: true });
</script>

<template>
  <div class="flex gap-4 items-center flex-wrap">
    <div class="flex gap-1 items-center">
      <Checkbox
        v-model="model.linkCreated"
        binary
        input-id="dt_link_created"
        :disabled="disabled"
      />
      <label
        for="dt_link_created"
        class="text-sm cursor-pointer select-none"
      >Связать подзадачи между собой</label>
      <i
        v-tooltip.top="'Каждая созданная подзадача попадёт в блок «Связанные задачи» остальных созданных'"
        class="pi pi-question-circle"
      />
    </div>

    <div class="flex gap-1 items-center">
      <Checkbox
        v-model="model.linkExisting"
        binary
        input-id="dt_link_existing"
        :disabled="disabled || !model.linkCreated"
      />
      <label
        for="dt_link_existing"
        class="text-sm cursor-pointer select-none"
        :class="{'opacity-60': !model.linkCreated}"
      >Связать и с прежними подзадачами</label>
      <i
        v-tooltip.top="'В блок «Связанные задачи» новых подзадач попадут и незавершённые подзадачи этой задачи, созданные ранее. Сами прежние подзадачи не изменяются, поэтому у них новые в списке не появятся'"
        class="pi pi-question-circle"
      />
    </div>
  </div>
</template>
