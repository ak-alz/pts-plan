import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getTaskIdFromUrl } from '../../utils.js';
import ImproveDescriptionApp from './ImproveDescriptionApp.vue';

export function improveDescription(sessionId) {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const titleBlock = document.querySelector('.ui-toolbar-title-item-box');
  if (!titleBlock) return;

  if (titleBlock.querySelector('.js-improve-description')) return;

  const buttonContainer = titleBlock.querySelector('.ui-toolbar-after-title');
  if (!buttonContainer) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-improve-description pts-app',
    style: 'order: 4;',
  });

  buttonContainer.appendChild(appContainer);

  const app = createApp(ImproveDescriptionApp, {
    sessionId,
    taskId: ids.taskId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);
  app.mount(appContainer);
}
