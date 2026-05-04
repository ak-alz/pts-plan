import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getGroupIdFromUrl } from '../../utils.js';
import TaskAnalysisApp from './TaskAnalysisApp.vue';

export function taskAnalysis(sessionId, options) {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-task-analysis');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-task-analysis',
    style: 'order: 4;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(TaskAnalysisApp, {
    sessionId,
    groupId,
    options,
  });
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
}
