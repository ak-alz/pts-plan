import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getTaskIdFromUrl } from '../../utils.js';
import ExportTaskApp from './ExportTaskApp.vue';

export async function exportTask(sessionId) {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const titleBlock = document.querySelector('.ui-toolbar-title-item-box');
  if (!titleBlock) return;

  const initialized = !!titleBlock.querySelector('.js-export-task');
  if (initialized) return;

  const buttonContainer = titleBlock.querySelector('.ui-toolbar-after-title');
  if (!buttonContainer) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-export-task',
    style: 'order: 3;',
  });

  buttonContainer.appendChild(appContainer);

  const app = createApp(ExportTaskApp, {
    sessionId,
    taskId: ids.taskId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);
  app.mount(appContainer);
}
