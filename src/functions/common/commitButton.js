import createVueApp from '@/vue/createVueApp';
import App from '@/vue/apps/commit-button/App.vue';

export default function commitButton() {
  if (!window.location.href.includes('/tasks/task/view/')) return;

  const container = document.querySelector('.pagetitle');
  if (!container) return;

  createVueApp(
    container,
    'commit-button',
    App,
  );
}
