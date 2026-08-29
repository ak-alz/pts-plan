import {showToast} from '../../toastHost/showToast.js';
import {getCommitMessage, rehydrateOnChanges} from '../../utils.js';

(() => {
  const kanbanGrid = document.querySelector('.main-kanban-grid');
  if (!kanbanGrid) return;

  function addButtons() {
    const kanbanCards = kanbanGrid.querySelectorAll('.main-kanban-item[data-id] .tasks-kanban-item:not([data-kanban-commit-processed])');

    kanbanCards.forEach((card) => {
      card.dataset.kanbanCommitProcessed = '1';

      const taskId = card.closest('.main-kanban-item[data-id]')?.dataset.id;
      if (!taskId) return;

      const titleElement = card.querySelector('.tasks-kanban-item-title');
      if (!titleElement) return;

      const control = card.querySelector('.tasks-kanban-item-control');
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
          const commitMessage = getCommitMessage(currentTitle, taskId);
          await navigator.clipboard.writeText(commitMessage);
          showToast({severity: 'success', summary: 'Скопировано', detail: commitMessage, life: 3000});
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
