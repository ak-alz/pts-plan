import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getGroupIdFromUrl, refreshActionBarButtonGroup } from '../../utils.js';
import SprintPrioritiesApp from './SprintPrioritiesApp.vue';

export function sprintPriorities(sessionId) {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-sprint-priorities');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-sprint-priorities pts-actions-bar-btn',
    style: 'order: 6;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(SprintPrioritiesApp, {
    sessionId,
    groupId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
  refreshActionBarButtonGroup();
}
