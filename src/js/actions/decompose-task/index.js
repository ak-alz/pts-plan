import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import BitrixApi from '../../BitrixApi.js';
import primeVueOptions from '../../primeVueOptions.js';
import { getTaskAndGroupIdsFromUrl } from '../../utils.js';
import DecomposeTaskApp from './DecomposeTaskApp.vue';

export async function decomposeTask(sessionId, userId) {
  if (!userId) return;

  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  if (!ids?.taskId) return;

  let groupId = ids.groupId;

  // На личных задачах URL вида /company/personal/user/{userId}/tasks/task/view/{taskId}/
  // getTaskAndGroupIdsFromUrl возвращает userId вместо groupId — получаем настоящий groupId через API
  if (window.location.pathname.includes('/company/personal/user/')) {
    try {
      const api = new BitrixApi(sessionId);
      const { data } = await api.getTask(ids.taskId);
      groupId = String(data?.result?.task?.groupId ?? '');
    } catch {
      return;
    }
    if (!groupId || groupId === '0') return;
  }

  const titleBlock = document.querySelector('.ui-toolbar-title-item-box');
  if (!titleBlock) return;

  const initialized = !!titleBlock.querySelector('.js-decompose-task');
  if (initialized) return;

  const responsiveBlock = document.querySelector('.task-user-selector.single:not(.readonly) [data-item-value]');
  if (!responsiveBlock) return;
  const responsiveId = Number(responsiveBlock.getAttribute('data-item-value'));

  const buttonContainer = titleBlock.querySelector('.ui-toolbar-after-title');
  if (!buttonContainer) return;

  const taskTitle = titleBlock.textContent.trim();

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-decompose-task',
  });

  buttonContainer.appendChild(appContainer);

  const app = createApp(DecomposeTaskApp, {
    sessionId,
    userId,
    responsiveId,
    taskTitle,
    groupId,
    taskId: ids.taskId,
  });
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);

  app.mount(appContainer);
}
