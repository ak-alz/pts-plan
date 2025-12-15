import { getTaskAndGroupIdsFromUrl } from '../../utils.js';

(() => {
  function replaceLastTaskIdInTitle(title, taskId) {
    if (!title || typeof title !== 'string') return `| ${taskId}`;

    // Убираем пробелы в конце строки для чистоты
    const trimmed = title.trimEnd();

    // Регулярка ищет последний блок после "|", который может быть:
    // - числом (возможно с + в конце): 100, 13, 5+
    // - знаком "?"
    // - знаком "-"
    // - пустым (просто "| " в конце)
    // Всё это после последнего "|", с возможными пробелами
    const regex = /\|\s*(\d+\+?|\?|-)?\s*$/;

    if (regex.test(trimmed)) {
      // Нашли "| что-то" в конце — заменяем весь этот блок на "| taskId"
      return trimmed.replace(regex, `| ${taskId}`);
    } else {
      // Ничего похожего на баллы не нашли — просто добавляем "| taskId"
      return `${trimmed} | ${taskId}`;
    }
  }

  async function init() {
    const ids = getTaskAndGroupIdsFromUrl(window.location.href);
    if (!ids?.taskId) return;

    const titleBlock = document.querySelector('.ui-toolbar-title-item-box');
    if (!titleBlock) return;

    const initialized = !!titleBlock.querySelector('.js-commit-button');
    if (initialized) return;

    const title = titleBlock.textContent.trim();
    if (!title) return;

    const commitButtonContainer = titleBlock.querySelector('.ui-toolbar-after-title');
    if (!commitButtonContainer) return;

    const commitMessage = replaceLastTaskIdInTitle(title, ids.taskId);

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
