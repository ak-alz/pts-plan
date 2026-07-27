import BitrixApi from '../../BitrixApi.js';
import {showToast} from '../../toastHost/showToast.js';
import {getTagallCommentText, getTaskIdFromUrl, rehydrateOnChanges} from '../../utils.js';

/**
 * Имя пользователя по ID. Кэш нужен канбану — там имена постановщиков повторяются от карточки
 * к карточке; для одиночного вызова его можно не передавать.
 */
async function resolveUserName(bitrixApi, userId, userNameCache = new Map()) {
  if (userNameCache.has(userId)) return userNameCache.get(userId);

  const users = await bitrixApi.getImUsersBatch([userId]);
  const user = users[userId];
  const userName = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || userId;
  userNameCache.set(userId, userName);
  return userName;
}

export function tagallButton(sessionId, options) {
  const bitrixApi = new BitrixApi(sessionId);
  const commentSuffix = options?.tagallButtonSuffix;
  const authorOnly = options?.tagallButtonAuthorOnly;

  if (options?.tagallButtonKanban) {
    setupKanbanButton(bitrixApi, commentSuffix, authorOnly);
  }
  setupTaskCommentButton(bitrixApi, commentSuffix, authorOnly);
}

function setupKanbanButton(bitrixApi, commentSuffix, authorOnly) {
  const kanbanGrid = document.querySelector('.main-kanban-grid');
  if (!kanbanGrid) return;

  const userNameCache = new Map();

  async function addKanbanButtons() {
    const items = [...kanbanGrid.querySelectorAll('.main-kanban-item[data-id]:not([data-tagall-processed])')];
    if (!items.length) return;

    // Помечаем сразу, синхронно — до await, иначе повторный вызов rehydrateOnChanges (например,
    // от собственной подгрузки карточек) успеет обработать те же карточки ещё раз
    items.forEach((item) => {
      item.dataset.tagallProcessed = '1';
    });

    let createdByByTaskId = {};
    if (authorOnly) {
      try {
        const taskIds = items.map((item) => item.dataset.id).filter(Boolean);
        const tasks = await bitrixApi.getTasksByIdsBatch(taskIds, ['ID', 'CREATED_BY']);
        createdByByTaskId = Object.fromEntries(taskIds.map((taskId) => [taskId, tasks[taskId]?.createdBy]));

        const unresolvedUserIds = [...new Set(Object.values(createdByByTaskId).filter(Boolean))];
        await Promise.all(unresolvedUserIds.map((userId) => resolveUserName(bitrixApi, userId, userNameCache)));
      } catch (error) {
        console.warn(error);
      }
    }

    items.forEach((item) => {
      const taskId = item.dataset.id;
      if (!taskId) return;

      const control = item.querySelector('.tasks-kanban-item-control');
      if (!control) return;

      const createdBy = createdByByTaskId[taskId];
      // Постановщик не определён (ошибка запроса или задача без CREATED_BY) — тегать некого
      if (authorOnly && !createdBy) return;

      const commentText = authorOnly
        ? getTagallCommentText(commentSuffix, `[USER=${createdBy}]${userNameCache.get(createdBy)}[/USER]`)
        : getTagallCommentText(commentSuffix);

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
          // Успех — только когда Bitrix вернул ID созданного комментария: 4xx поймает axios, но
          // отказ может прийти и как 200 с полем error, и тогда кнопка позеленела бы впустую
          const {data} = await bitrixApi.addComment(taskId, commentText);
          if (!data?.result) throw new Error(data?.error_description || 'Bitrix не подтвердил публикацию комментария');

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

async function setupTaskCommentButton(bitrixApi, commentSuffix, authorOnly) {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const commentsBlock = document.querySelector('.feed-comments-block');
  if (!commentsBlock) return;

  let commentText;
  if (authorOnly) {
    try {
      const {data} = await bitrixApi.getTask(ids.taskId, ['CREATED_BY']);
      const createdBy = data?.result?.task?.createdBy;
      if (!createdBy) return; // постановщик неизвестен — вставлять нечего

      const userName = await resolveUserName(bitrixApi, createdBy);
      commentText = getTagallCommentText(commentSuffix, `[USER=${createdBy}]${userName}[/USER]`);
    } catch (error) {
      console.warn(error);
      return;
    }
  } else {
    commentText = getTagallCommentText(commentSuffix);
  }

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
