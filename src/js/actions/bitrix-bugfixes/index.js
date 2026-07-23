import {getTaskIdFromUrl, insertCSS, waitForElement} from '../../utils.js';

async function redirectAfterTaskCreate() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('EVENT_TYPE') !== 'ADD') return;

  const taskId = url.searchParams.get('EVENT_TASK_ID');
  if (!taskId) return;

  // BACKURL — то же скрытое поле формы tasks.task.edit, которое Bitrix сам использует
  // для редиректа в iframe-версии (шаблон с плейсхолдерами #action#/#task_id#).
  // Bitrix подставляет поля этой формы асинхронно, поэтому его может не быть в момент запуска.
  const backUrlInput = await waitForElement('input[name="BACKURL"]');
  if (!backUrlInput?.value) return;

  const viewUrl = backUrlInput.value
    .replace('#action#', 'view')
    .replace('#task_id#', taskId);

  window.location.replace(viewUrl);
}

function scrollUserLists() {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  // .task-detail-sidebar-info-users-list — общий класс Bitrix для блоков «Соисполнители»
  // и «Наблюдатели» в сайдбаре задачи; у одиночных «Постановщик»/«Исполнитель» его нет.
  insertCSS(`
    .task-detail-sidebar-info-users-list {
      max-height: 500px;
      overflow-y: auto;
    }
    .task-detail-sidebar-info-user-del {
      right: 0 !important;
    }
  `, 'pts-scroll-user-lists');
}

export function bitrixBugfixes(options = {}) {
  if (options.bitrixBugfixesRedirectAfterTaskCreate) {
    redirectAfterTaskCreate();
  }

  if (options.bitrixBugfixesScrollUserLists) {
    scrollUserLists();
  }
}
