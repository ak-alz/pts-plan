import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getTaskAndGroupIdsFromUrl } from '../../utils.js';
import DecomposeTaskApp from './DecomposeTaskApp.vue';

export function decomposeTask(sessionId, userId) {
  if (!userId) return;

  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const titleBlock = document.querySelector('.ui-toolbar-title-item-box');
  if (!titleBlock) return;

  const initialized = !!titleBlock.querySelector('.js-decompose-task');
  if (initialized) return;

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
    taskTitle,
    groupId: ids.groupId,
    taskId: ids.taskId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
}
