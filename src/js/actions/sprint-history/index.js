import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import { resolveKanbanContext } from '../../kanbanContext.js';
import primeVueOptions from '../../primeVueOptions.js';
import { refreshActionBarButtonGroup } from '../../utils.js';
import SprintHistoryApp from './SprintHistoryApp.vue';

export async function sprintHistory(sessionId) {
  const context = await resolveKanbanContext(sessionId);
  if (!context) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-sprint-history');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-sprint-history pts-actions-bar-btn pts-app',
    style: 'order: 2;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(SprintHistoryApp, {
    sessionId,
    context,
  });
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
  refreshActionBarButtonGroup();
}
