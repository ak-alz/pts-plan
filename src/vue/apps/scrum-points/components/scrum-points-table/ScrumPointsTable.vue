<script setup>
import { inject } from 'vue';
import ScrumSummaryPoints from '../scrum-summary-points/ScrumSummaryPoints.vue';
import CrmUser from '../crm-user/CrmUser.vue';
import UserPoints from '../user-points/UserPoints.vue';
import KanbanCell from '../kanban-cell/KanbanCell.vue';

defineProps({
  columns: {
    type: Array,
    default() {
      return [];
    },
  },
  users: {
    type: Array,
    default() {
      return [];
    },
  },
});

const settings = inject('settings');

const emits = defineEmits(['copy']);

const onCopy = (columnId) => {
  emits('copy', columnId);
};
</script>

<template>
  <div class="scrum-points-table">
    <table class="scrum-points-table__table">
      <thead>
        <tr>
          <th class="scrum-points-table__sticky">
            Пользователь
          </th>
          <KanbanCell
            v-for="column in columns"
            :key="column.id"
            :column="column"
          />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="user in users"
          :key="user.id"
        >
          <td class="scrum-points-table__sticky">
            <CrmUser
              :photo="user.photo"
              :name="user.name"
              :url="user.url"
            />
          </td>
          <UserPoints
            v-for="column in columns"
            :key="column.id"
            :column
            :user
          />
        </tr>
        <tr
          v-if="settings.showSummary"
          class="scrum-points-table__summary"
        >
          <td class="scrum-points-table__sticky">
            Итого
          </td>
          <ScrumSummaryPoints
            v-for="column in columns"
            :key="column.id"
            :column="column.id"
            :users
            @copy="onCopy"
          />
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
