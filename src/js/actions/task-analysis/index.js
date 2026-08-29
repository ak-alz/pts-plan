import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import { resolveKanbanContext } from '../../kanbanContext.js';
import primeVueOptions from '../../primeVueOptions.js';
import { insertCSS, refreshActionBarButtonGroup } from '../../utils.js';
import TaskAnalysisApp from './TaskAnalysisApp.vue';

insertCSS(`
  .pts-ai-result * { font-size: 14px; }
  .pts-ai-result > *:first-child { margin-top: 0; }
  .pts-ai-result > *:last-child { margin-bottom: 0; }
`, 'pts-ai-result');

export async function taskAnalysis(sessionId, options) {
  const context = await resolveKanbanContext(sessionId);
  if (!context) return;

  const buttonsContainer = document.querySelector('.ui-actions-bar__buttons');
  if (!buttonsContainer) return;

  const initialized = !!buttonsContainer.querySelector('.js-task-analysis');
  if (initialized) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-task-analysis pts-actions-bar-btn pts-app',
    style: 'order: 4;',
  });

  buttonsContainer.appendChild(appContainer);

  const app = createApp(TaskAnalysisApp, {
    sessionId,
    context,
    options,
  });
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
  refreshActionBarButtonGroup();
}
