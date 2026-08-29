<script setup>
import { computed } from 'vue';

const props = defineProps({
  // Виджеты со статистикой по людям добавляют вторую фразу: у них смещение выборки влияет
  // на сами цифры, а не только на состав задач
  withPerformerNote: {
    type: Boolean,
    default: false,
  },
});

const SCOPE_NOTE = 'В личном плане собраны все задачи, где вы исполнитель, постановщик, соисполнитель или наблюдатель, — в том числе чужие.';
const PERFORMER_NOTE = 'Поэтому цифры по исполнителям показывают только ту часть их работы, к которой причастны вы, а не всю.';

const tooltip = computed(() => (props.withPerformerNote ? `${SCOPE_NOTE} ${PERFORMER_NOTE}` : SCOPE_NOTE));
</script>

<template>
  <i
    v-tooltip.top="tooltip"
    class="pi pi-exclamation-triangle text-yellow-500 cursor-default"
  />
</template>
