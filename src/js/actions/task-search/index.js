import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import { resolveKanbanContext } from '../../kanbanContext.js';
import primeVueOptions from '../../primeVueOptions.js';
import { refreshActionBarButtonGroup } from '../../utils.js';
import TaskSearchApp from './TaskSearchApp.vue';

export async function taskSearch(sessionId) {
  const context = await resolveKanbanContext(sessionId);
  if (!context) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-task-search');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-task-search pts-actions-bar-btn pts-app',
    style: 'order: 6;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(TaskSearchApp, {
    sessionId,
    context,
  });
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
  refreshActionBarButtonGroup();
}
