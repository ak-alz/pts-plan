import { getCommitMessage, getTaskIdFromUrl } from '../../utils.js';

(() => {
  async function init() {
    const ids = getTaskIdFromUrl(window.location.href);
    if (!ids?.taskId) return;

    const titleBlock = document.querySelector('.ui-toolbar-title-item-box');
    if (!titleBlock) return;

    const initialized = !!titleBlock.querySelector('.js-commit-button');
    if (initialized) return;

    const title = titleBlock.textContent.trim();
    if (!title) return;

    const commitButtonContainer = titleBlock.querySelector('.ui-toolbar-after-title');
    if (!commitButtonContainer) return;

    const commitMessage = getCommitMessage(title, ids.taskId);

    const commitButton = Object.assign(document.createElement('button'), {
      className: 'js-commit-button commit-button',
      type: 'button',
      title: 'Копировать текст коммита',
      innerHTML: '<i class="pi pi-github"></i>',
    });

    commitButton.addEventListener('click', async () => {
      try {
        commitButton.classList.add('commit-button--success');

        await navigator.clipboard.writeText(commitMessage);

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
