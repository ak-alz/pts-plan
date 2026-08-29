import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import { resolveKanbanContext } from '../../kanbanContext.js';
import primeVueOptions from '../../primeVueOptions.js';
import { refreshActionBarButtonGroup } from '../../utils.js';
import ExportGroupTasksApp from './ExportGroupTasksApp.vue';

export async function exportGroupTasks(sessionId) {
  const context = await resolveKanbanContext(sessionId);
  if (!context) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-export-group-tasks');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-export-group-tasks pts-actions-bar-btn pts-app',
    style: 'order: 8;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(ExportGroupTasksApp, {
    sessionId,
    context,
  });
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
  refreshActionBarButtonGroup();
}
