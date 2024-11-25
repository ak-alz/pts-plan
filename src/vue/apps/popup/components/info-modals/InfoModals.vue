<script setup>
import VModal from '@/vue/ui/modal/VModal.vue';
import { computed } from 'vue';

const state = defineModel({
  type: Object,
  required: true,
});

const modals = computed(() => Object.keys(state.value));
</script>

<template>
  <VModal v-for="modal in modals" :key="modal" v-model="state[modal]">
    <slot :name="modal">
      Здесь будет описание функционала
    </slot>
  </VModal>
</template>

<style scoped
       lang="scss"
>

</style>
