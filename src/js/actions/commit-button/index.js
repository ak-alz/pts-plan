import {showToast} from '../../toastHost/showToast.js';
import { getCommitMessage, getTaskIdFromUrl } from '../../utils.js';

const TITLE_SELECTOR = '.ui-toolbar-title-item-box .ui-toolbar-title-item';

(() => {
  async function init() {
    const ids = getTaskIdFromUrl(window.location.href);
    if (!ids?.taskId) return;

    const titleBlock = document.querySelector('.ui-toolbar-title-item-box');
    if (!titleBlock) return;

    const initialized = !!titleBlock.querySelector('.js-commit-button');
    if (initialized) return;

    if (!document.querySelector(TITLE_SELECTOR)?.textContent.trim()) return;

    const commitButtonContainer = titleBlock.querySelector('.ui-toolbar-after-title');
    if (!commitButtonContainer) return;

    const commitButton = Object.assign(document.createElement('button'), {
      className: 'js-commit-button commit-button',
      style: 'order: 1;',
      type: 'button',
      title: 'Копировать текст коммита',
      innerHTML: '<i class="pi pi-github"></i>',
    });

    commitButton.addEventListener('click', async () => {
      try {
        commitButton.classList.add('commit-button--success');

        // Название ищем в момент клика — задачу могли переименовать без перезагрузки, а Bitrix — перерисовать заголовок
        const title = document.querySelector(TITLE_SELECTOR)?.textContent.trim() ?? '';
        const commitMessage = getCommitMessage(title, ids.taskId);

        await navigator.clipboard.writeText(commitMessage);
        showToast({severity: 'success', summary: 'Скопировано', detail: commitMessage, life: 3000});

        setTimeout(() => {
          commitButton.classList.remove('commit-button--success');
        }, 1000);
      } catch (e) {
        console.warn(e);
      }
    });

    commitButtonContainer.appendChild(commitButton);
  }

  init();
})();
