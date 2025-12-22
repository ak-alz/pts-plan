import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getGroupIdFromUrl } from '../../utils.js';
import ScrumPointsApp from './ScrumPointsApp.vue';

export function scrumPoints(sessionId) {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-scrum-points');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-scrum-points',
    style: 'order: 1;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(ScrumPointsApp, {
    sessionId,
    groupId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
}
