<script setup>
import { provide, ref } from 'vue';
import ScrumPointsModal from './components/scrum-points-modal/ScrumPointsModal.vue';
import ScrumPointsApi from './ScrumPointsApi';

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

const api = new ScrumPointsApi(props.bitrixSessionId);

provide('api', api);
provide('groupId', props.groupId);

const isModalOpened = ref(false);
</script>

<template>
  <div class="scrum-points">
    <button
      class="ui-btn ui-btn-xs ui-btn-light-border ui-btn-no-caps ui-btn-themes ui-btn-round"
      type="button"
      @click="isModalOpened = true"
    >
      Scrum
    </button>
    <ScrumPointsModal v-model="isModalOpened" />
  </div>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
