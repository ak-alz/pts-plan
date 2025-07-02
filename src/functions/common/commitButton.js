import createVueApp from '@/vue/createVueApp';
import App from '@/vue/apps/commit-button/App.vue';

export default function commitButton() {
  if (!window.location.href.includes('/tasks/task/view/')) return;

  let container = document.querySelector('.ui-toolbar-title-item-box');
  if (!container) return;

  if (container.querySelector('.ui-toolbar-title-item-box-buttons')) {
    container = container.querySelector('.ui-toolbar-title-item-box-buttons');
  }

  createVueApp(
    container,
    'commit-button',
    App,
  );
}
