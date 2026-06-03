import {getCommitMessage, rehydrateOnChanges} from '../../utils.js';

(() => {
  const kanbanGrid = document.querySelector('.main-kanban-grid');
  if (!kanbanGrid) return;

  function addButtons() {
    const kanbanItems = kanbanGrid.querySelectorAll('.main-kanban-item[data-id]:not([data-kanban-commit-processed])');

    kanbanItems.forEach((item) => {
      item.dataset.kanbanCommitProcessed = '1';

      const taskId = item.dataset.id;
      if (!taskId) return;

      const titleElement = item.querySelector('.tasks-kanban-item-title');
      if (!titleElement) return;

      const control = item.querySelector('.tasks-kanban-item-control');
      if (!control) return;

      const button = Object.assign(document.createElement('button'), {
        className: 'kanban-commit-button',
        type: 'button',
        title: 'Копировать название коммита',
        innerHTML: '<i class="pi pi-github"></i>',
      });

      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        try {
          button.classList.add('kanban-commit-button--success');
          const currentTitle = titleElement.textContent.trim();
          await navigator.clipboard.writeText(getCommitMessage(currentTitle, taskId));
          setTimeout(() => {
            button.classList.remove('kanban-commit-button--success');
          }, 1000);
        } catch (error) {
          console.warn(error);
        }
      });

      control.insertBefore(button, control.firstChild);
    });
  }

  addButtons();
  rehydrateOnChanges(addButtons, kanbanGrid);
})();
