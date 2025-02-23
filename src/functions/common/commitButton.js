import createVueApp from '@/vue/createVueApp';
import App from '@/vue/apps/commit-button/App.vue';

export default function commitButton() {
  if (!window.location.href.includes('/tasks/task/view/')) return;

  let container = document.querySelector('.pagetitle');
  if (!container) return;

  if (container.querySelector('.pagetitle-item__additional-actions-container')) {
    container = container.querySelector('.pagetitle-item');
  }

  createVueApp(
    container,
    'commit-button',
    App,
  );
}
