<script setup>
import InputsTree from '@/vue/apps/popup/components/inputs-tree/InputsTree.vue';

defineProps({
  inputs: {
    type: Array,
    default() {
      return [];
    },
  },
});

const state = defineModel({
  type: Object,
  required: true,
});

const emits = defineEmits(['openModal']);

const onOpenModal = (id) => {
  emits('openModal', id);
};
</script>

<template>
  <div class="search-result">
    <InputsTree
      v-if="inputs.length"
      v-model="state"
      :inputs="inputs"
      @open-modal="onOpenModal"
    />
    <div
      v-else
      class="search-result__notice"
    >
      Результатов не найдено
    </div>
  </div>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
