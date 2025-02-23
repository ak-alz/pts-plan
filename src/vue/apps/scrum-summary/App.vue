<script setup>
import { provide, ref } from 'vue';
import ScrumSummaryModal from './components/scrum-summary-modal/ScrumSummaryModal.vue';
import ScrumSummaryApi from './ScrumSummaryApi';

const props = defineProps({
  bitrixSessionId: {
    type: String,
    required: true,
  },
  groupId: {
    type: [String, Number],
    required: true,
  },
});

const api = new ScrumSummaryApi(props.bitrixSessionId);

provide('api', api);
provide('groupId', props.groupId);

const isModalOpened = ref(false);
</script>

<template>
  <div class="scrum-summary">
    <button
      class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round"
      type="button"
      @click="isModalOpened = true"
    >
      Scrum Сводка
    </button>
    <ScrumSummaryModal v-model="isModalOpened" />
  </div>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
