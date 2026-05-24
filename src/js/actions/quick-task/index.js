import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import {createApp} from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import {getGroupIdFromUrl} from '../../utils.js';
import QuickTaskApp from './QuickTaskApp.vue';

export function quickTask(sessionId) {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  if (!document.querySelector('.main-kanban-column')) return;

  if (document.querySelector('.js-quick-task')) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-quick-task',
  });
  document.body.appendChild(appContainer);

  const app = createApp(QuickTaskApp, {
    sessionId,
    groupId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);
  app.mount(appContainer);

  document.querySelectorAll('.main-kanban-column-add-item-button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const column = btn.closest('.main-kanban-column');
      const stageId = column?.querySelector('.main-kanban-column-body')?.dataset?.id ?? null;
      const columnName = column?.querySelector('.main-kanban-column-title-text-inner')?.textContent?.trim() ?? '';
      document.dispatchEvent(new CustomEvent('pts:quick-task:open', {
        detail: {stageId, columnName},
      }));
    });
  });
}
