import createVueApp from '@/vue/createVueApp';
import ScrumPoints from '@/vue/apps/scrum-points/ScrumPoints.vue';
import getGroupId from '@/functions/core/getGroupId';

export default function scrumPoints(bitrixSessionId) {
  if (!window.location.href.includes('/tasks/')) return;
  if (window.location.href.includes('/task/view/')) return;

  const groupId = getGroupId();
  if (!groupId) return;

  if (!document.querySelector('.main-kanban')) return;

  const container = document.querySelector('.task-interface-toolbar');
  if (!container) return;

  createVueApp(
    container,
    'scrum-points',
    ScrumPoints,
    {
      bitrixSessionId,
      groupId,
    },
  );
}
