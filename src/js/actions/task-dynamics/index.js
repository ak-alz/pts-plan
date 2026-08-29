import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import { resolveKanbanContext } from '../../kanbanContext.js';
import primeVueOptions from '../../primeVueOptions.js';
import { refreshActionBarButtonGroup } from '../../utils.js';
import TaskDynamicsApp from './TaskDynamicsApp.vue';

export async function taskDynamics(sessionId, options) {
  const context = await resolveKanbanContext(sessionId);
  if (!context) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-task-dynamics');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-task-dynamics pts-actions-bar-btn pts-app',
    style: 'order: 5;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(TaskDynamicsApp, {
    sessionId,
    context,
    options,
  });
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
  refreshActionBarButtonGroup();
}
