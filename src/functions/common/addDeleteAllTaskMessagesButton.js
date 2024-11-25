import createVueApp from '@/vue/createVueApp';
import DeleteTaskMessages from '@/vue/apps/delete-task-messages/DeleteTaskMessages.vue';

// Добавить кнопку для удаления всех уведомлений текущей задачи
export default function addDeleteAllTaskMessagesButton(bitrixSessionId) {
  if (!window.location.href.includes('/tasks/task/view/')) return;

  const container = document.querySelector('.task-detail-like');
  if (!container) return;

  createVueApp(
    container,
    'delete-task-messages',
    DeleteTaskMessages,
    {
      bitrixSessionId,
    },
  );
}
