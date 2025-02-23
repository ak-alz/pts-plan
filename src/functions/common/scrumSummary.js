import createVueApp from '@/vue/createVueApp';
import App from '@/vue/apps/scrum-summary/App.vue';
import getGroupId from '@/functions/core/getGroupId';

export default function scrumSummary(bitrixSessionId) {
  if (!window.location.href.includes('/tasks/')) return;
  if (window.location.href.includes('/task/view/')) return;

  const groupId = getGroupId();
  if (!groupId) return;

  if (!document.querySelector('.main-kanban')) return;

  const container = document.querySelector('.task-interface-toolbar');
  if (!container) return;

  createVueApp(
    container,
    'scrum-summary',
    App,
    {
      bitrixSessionId,
      groupId,
    },
  );
}
