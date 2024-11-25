<script setup>
import VModal from '@/vue/ui/modal/VModal.vue';
import { inject } from 'vue';

defineProps({
  column: {
    type: Object,
    required: true,
  },
  user: {
    type: Object,
    required: true,
  },
  points: {
    type: Number,
    default: 0,
  },
});

const groupId = inject('groupId');

const isModalOpened = defineModel({
  type: Boolean,
  required: true,
});
</script>

<template>
  <VModal
    v-model="isModalOpened"
    size="big"
  >
    <div class="user-tasks-modal">
      <div class="user-tasks-modal__head">
        Задачи {{ user.name }} в колонке «{{ column.name }}»
      </div>
      <div class="user-tasks-modal__table-wrapper">
        <table class="user-tasks-modal__table">
          <thead>
            <tr>
              <th>Название задачи</th>
              <th>Баллы</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="task in user.columns[column.id]"
              :key="task.id"
            >
              <td>
                <a
                  :href="`/workgroups/group/${groupId}/tasks/task/view/${task.id}/`"
                  v-html="task.name"
                />
              </td>
              <td class="user-tasks-modal__points">
                {{ task.points.value }}
              </td>
            </tr>
            <tr class="user-tasks-modal__table-summary">
              <td>Итого</td>
              <td>{{ points }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </VModal>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
