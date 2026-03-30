import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getTaskIdFromUrl } from '../../utils.js';
import DecomposeTaskApp from './DecomposeTaskApp.vue';

export async function decomposeTask(sessionId, userId) {
  if (!userId) return;

  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const titleBlock = document.querySelector('.ui-toolbar-title-item-box');
  if (!titleBlock) return;

  const initialized = !!titleBlock.querySelector('.js-decompose-task');
  if (initialized) return;

  const responsiveBlock = document.querySelector('.task-user-selector.single:not(.readonly) [data-item-value]');
  if (!responsiveBlock) return;
  const responsiveId = Number(responsiveBlock.getAttribute('data-item-value'));

  const buttonContainer = titleBlock.querySelector('.ui-toolbar-after-title');
  if (!buttonContainer) return;

  const taskTitle = titleBlock.textContent.trim();

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-decompose-task',
  });

  buttonContainer.appendChild(appContainer);

  const app = createApp(DecomposeTaskApp, {
    sessionId,
    userId,
    responsiveId,
    taskTitle,
    taskId: ids.taskId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
}
