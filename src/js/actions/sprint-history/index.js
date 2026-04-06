import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getGroupIdFromUrl } from '../../utils.js';
import SprintHistoryApp from './SprintHistoryApp.vue';

export function sprintHistory(sessionId) {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-sprint-history');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-sprint-history',
    style: 'order: 2;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(SprintHistoryApp, {
    sessionId,
    groupId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
}
