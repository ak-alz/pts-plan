import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getGroupIdFromUrl, refreshActionBarButtonGroup } from '../../utils.js';
import TaskDynamicsApp from './TaskDynamicsApp.vue';

export function taskDynamics(sessionId, options) {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-task-dynamics');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-task-dynamics pts-actions-bar-btn',
    style: 'order: 5;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(TaskDynamicsApp, {
    sessionId,
    groupId,
    options,
  });
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
  refreshActionBarButtonGroup();
}
