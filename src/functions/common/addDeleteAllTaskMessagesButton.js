import createVueApp from '@/vue/createVueApp';
import App from '@/vue/apps/delete-task-messages/App.vue';

// Добавить кнопку для удаления всех уведомлений текущей задачи
export default function addDeleteAllTaskMessagesButton(bitrixSessionId) {
  if (!window.location.href.includes('/tasks/task/view/')) return;

  const container = document.querySelector('.task-detail-like');
  if (!container) return;

  createVueApp(
    container,
    'delete-task-messages',
    App,
    {
      bitrixSessionId,
    },
  );
}
