import BitrixApi from '../../BitrixApi.js';
import {showToast} from '../../toastHost/showToast.js';
import {getTagallCommentText, getTaskIdFromUrl, rehydrateOnChanges} from '../../utils.js';

export function tagallButton(sessionId, commentSuffix) {
  const commentText = getTagallCommentText(commentSuffix);

  setupKanbanButton(sessionId, commentText);
  setupTaskCommentButton(commentText);
}

function setupKanbanButton(sessionId, commentText) {
  const kanbanGrid = document.querySelector('.main-kanban-grid');
  if (!kanbanGrid) return;

  const bitrixApi = new BitrixApi(sessionId);

  function addKanbanButtons() {
    const kanbanItems = kanbanGrid.querySelectorAll('.main-kanban-item[data-id]:not([data-tagall-processed])');

    kanbanItems.forEach((item) => {
      item.dataset.tagallProcessed = '1';

      const taskId = item.dataset.id;
      if (!taskId) return;

      const control = item.querySelector('.tasks-kanban-item-control');
      if (!control) return;

      const button = Object.assign(document.createElement('button'), {
        className: 'tagall-button',
        type: 'button',
        title: `Опубликовать комментарий: «${commentText}»`,
        innerHTML: '<i class="pi pi-check-circle"></i>',
      });

      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (button.hasAttribute('disabled')) return;

        button.setAttribute('disabled', '');

        try {
          await bitrixApi.addComment(taskId, commentText);
          button.classList.add('tagall-button--success');
          button.title = 'Комментарий уже опубликован — обновите страницу, чтобы отправить ещё раз';
          showToast({severity: 'success', summary: 'Комментарий опубликован', detail: commentText, life: 3000});
          return;
        } catch (error) {
          console.warn(error);
          button.classList.add('tagall-button--error');
          showToast({severity: 'error', summary: 'Не удалось опубликовать комментарий', detail: error.message, life: 5000});
        }

        setTimeout(() => {
          button.classList.remove('tagall-button--error');
          button.removeAttribute('disabled');
        }, 1000);
      });

      control.insertBefore(button, control.firstChild);
    });
  }

  addKanbanButtons();
  rehydrateOnChanges(addKanbanButtons, kanbanGrid);
}

// Комментарий рендерится в rich-text iframe (Bitrix "LHE"-редактор) — вставляем через
// execCommand в его contentDocument, тот же приём, что использует сам редактор для bold/italic.
// Если текст уже вставлен (повторный клик), не дублируем его.
function insertTextIntoEditor(form, text) {
  const iframeDocument = form.querySelector('.bx-editor-iframe')?.contentDocument;
  if (!iframeDocument?.body) return;

  if (iframeDocument.body.textContent.includes(text)) return;

  iframeDocument.body.focus();
  iframeDocument.execCommand('insertText', false, text);
}

function setupTaskCommentButton(commentText) {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const commentsBlock = document.querySelector('.feed-comments-block');
  if (!commentsBlock) return;

  function addCommentButtons() {
    // .bx-b-pixeplus-tag-all — нативная кнопка тегания всех участников в тулбаре редактора комментария,
    // рядом с ней располагаем свою
    const tagAllIcons = commentsBlock.querySelectorAll('.bx-b-pixeplus-tag-all');

    tagAllIcons.forEach((tagAllIcon) => {
      const toolbarItem = tagAllIcon.closest('.main-post-form-toolbar-button');
      if (!toolbarItem || toolbarItem.dataset.tagallCommentProcessed) return;

      toolbarItem.dataset.tagallCommentProcessed = '1';

      const form = toolbarItem.closest('.feed-add-post');
      if (!form) return;

      const button = Object.assign(document.createElement('div'), {
        className: 'tagall-comment-button',
        title: `Вставить «${commentText}»`,
        innerHTML: '<i class="pi pi-check-circle"></i>',
      });

      button.addEventListener('click', (event) => {
        event.stopPropagation();
        insertTextIntoEditor(form, commentText);
      });

      toolbarItem.insertAdjacentElement('afterend', button);
    });
  }

  addCommentButtons();
  rehydrateOnChanges(addCommentButtons, commentsBlock);
}
