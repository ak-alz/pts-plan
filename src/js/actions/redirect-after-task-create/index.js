import { waitForElement } from '../../utils.js';

(() => {
  async function init() {
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

  init();
})();
