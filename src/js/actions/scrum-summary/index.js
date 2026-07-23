import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getGroupIdFromUrl, insertCSS, refreshActionBarButtonGroup } from '../../utils.js';
import ScrumSummaryApp from './ScrumSummaryApp.vue';

insertCSS(`
  .pts-ai-result * { font-size: 14px; }
  .pts-ai-result > *:first-child { margin-top: 0; }
  .pts-ai-result > *:last-child { margin-bottom: 0; }
`, 'pts-ai-result');

export function scrumSummary(sessionId) {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-scrum-summary');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-scrum-summary pts-actions-bar-btn',
    style: 'order: 3;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(ScrumSummaryApp, {
    sessionId,
    groupId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
  refreshActionBarButtonGroup();
}
