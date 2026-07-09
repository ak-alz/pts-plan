import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getGroupIdFromUrl, refreshActionBarButtonGroup } from '../../utils.js';
import ExportGroupTasksApp from './ExportGroupTasksApp.vue';

export function exportGroupTasks(sessionId) {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-export-group-tasks');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-export-group-tasks pts-actions-bar-btn',
    style: 'order: 7;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(ExportGroupTasksApp, {
    sessionId,
    groupId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
  refreshActionBarButtonGroup();
}
