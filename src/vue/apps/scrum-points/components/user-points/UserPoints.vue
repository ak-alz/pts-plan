<script setup>
import { computed, inject, ref } from 'vue';
import UserTasksModal from '../user-tasks-modal/UserTasksModal.vue';

const props = defineProps({
  column: {
    type: Object,
    required: true,
  },
  user: {
    type: Object,
    required: true,
  },
});

const settings = inject('settings');

const tasksCount = computed(() => (props.user.columns[props.column.id]
  ? props.user.columns[props.column.id].length
  : 0));

const userPoints = computed(() => {
  if (tasksCount.value) {
    return props.user.columns[props.column.id]
      .reduce((acc, task) => acc + task.points.value, 0);
  }

  return '–';
});

const hasPlus = computed(() => {
  if (tasksCount.value) {
    return props.user.columns[props.column.id]
      .some(({ points }) => points.hasPlus);
  }

  return false;
});

const hasQuestion = computed(() => {
  if (tasksCount.value) {
    return props.user.columns[props.column.id]
      .some(({ points }) => points.hasQuestion);
  }

  return false;
});

const text = computed(() => {
  let string = userPoints.value;

  if (settings.value.showPlus && hasPlus.value) {
    string += '<span>+</span>';
  }

  if (settings.value.showQuestion && hasQuestion.value) {
    string += '<span>?</span>';
  }

  if (settings.value.showTasksCount && tasksCount.value) {
    string += ` <span>(${tasksCount.value})</span>`;
  }

  return string;
});

const isModalOpened = ref(false);
</script>

<template>
  <td>
    <div class="user-points">
      <button
        v-if="settings.showDetails && tasksCount"
        class="user-points__button"
        type="button"
        aria-label="Детальные данные"
        @click="isModalOpened = true"
        v-html="text"
      />
      <span v-else v-html="text" />
    </div>
    <UserTasksModal
      v-model="isModalOpened"
      :column
      :user
      :points="userPoints"
    />
  </td>
</template>

<style src="./styles.scss"
       lang="scss"
/>
