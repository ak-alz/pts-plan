import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getGroupIdFromUrl } from '../../utils.js';
import ScrumSummaryApp from './ScrumSummaryApp.vue';

export function scrumSummary(sessionId) {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-scrum-summary');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-scrum-summary',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(ScrumSummaryApp, {
    sessionId,
    groupId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
}
