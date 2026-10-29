import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import { getTaskIdFromUrl } from '../../utils.js';
import DecomposeTaskApp from './DecomposeTaskApp.vue';

export async function decomposeTask(sessionId) {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const titleBlock = document.querySelector('.ui-toolbar-title-item-box');
  if (!titleBlock) return;

  const initialized = !!titleBlock.querySelector('.js-decompose-task');
  if (initialized) return;

  const responsibleSelector = '.task-user-selector.single:not(.readonly) [data-item-value]';
  const initialResponsibleBlock = document.querySelector(responsibleSelector);
  if (!initialResponsibleBlock) return;
  const initialResponsibleId = Number(initialResponsibleBlock.getAttribute('data-item-value'));

  const buttonContainer = titleBlock.querySelector('.ui-toolbar-after-title');
  if (!buttonContainer) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-decompose-task pts-app',
    style: 'order: 2;',
  });

  buttonContainer.appendChild(appContainer);

  const app = createApp(DecomposeTaskApp, {
    sessionId,
    // Название и исполнителя читаем при открытии окна — их могли поменять без перезагрузки страницы
    readPageTask: () => ({
      title: document.querySelector('.ui-toolbar-title-item-box .ui-toolbar-title-item')?.textContent.trim() ?? '',
      responsibleId: Number(document.querySelector(responsibleSelector)?.getAttribute('data-item-value')) || initialResponsibleId,
    }),
    taskId: ids.taskId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
}
