<script setup>
import VModal from '@/vue/ui/modal/VModal.vue';
import { computed, inject } from 'vue';
import KanbanCell from '@/vue/apps/scrum-points/components/kanban-cell/KanbanCell.vue';

const props = defineProps({
  columns: {
    type: [Object, null],
    default: null,
  },
  column: {
    type: [Object, null],
    default: null,
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

const title = computed(() => {
  let result = `Задачи ${props.user.name}`;

  if (props.column) {
    result += ` в колонке «${props.column.name}»`;
  }

  return result;
});

const columnsArray = computed(() => {
  if (props.column) {
    return [props.column];
  }

  return props.columns;
});
</script>

<template>
  <VModal
    v-model="isModalOpened"
    size="large"
  >
    <div class="user-tasks-modal">
      <div class="user-tasks-modal__head">
        {{ title }}
      </div>
      <div class="user-tasks-modal__table-wrapper">
        <table class="user-tasks-modal__table">
          <thead>
            <tr>
              <th v-if="props.columns">
                Колонка
              </th>
              <th>Название задачи</th>
              <th>Баллы</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="columnItem in columnsArray" :key="columnItem.id">
              <template v-if="user.columns?.[columnItem.id]?.length">
                <tr
                  v-for="(task, i) in user.columns[columnItem.id]"
                  :key="task.id"
                >
                  <KanbanCell
                    v-if="props.columns && i === 0"
                    :column="columnItem"
                    :rowspan="user.columns[columnItem.id].length"
                  />
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
              </template>
            </template>
            <tr class="user-tasks-modal__table-summary">
              <td v-if="props.columns" />
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
