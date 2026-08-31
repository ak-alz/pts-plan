import BitrixApi from '../../BitrixApi.js';
import {insertCommentText} from '../../commentEditorBridge.js';
import {REVIEW_LINK_PLACEHOLDER_RE, REVIEW_LINK_WITH_SEPARATORS_RE} from '../../patterns.js';
import {showToast} from '../../toastHost/showToast.js';
import {getFirstLink, getTagallCommentText, getTaskIdFromUrl, rehydrateOnChanges} from '../../utils.js';

const DEFAULT_REVIEW_TEMPLATE = 'готово, можно проверять - {FIRST_LINK}';

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
  setupTaskCommentButton(bitrixApi, options);
}

function setupKanbanButton(bitrixApi, commentSuffix, authorOnly) {
  const kanbanGrid = document.querySelector('.main-kanban-grid');
  if (!kanbanGrid) return;

  const userNameCache = new Map();

  async function addKanbanButtons() {
    const cards = [...kanbanGrid.querySelectorAll('.main-kanban-item[data-id] .tasks-kanban-item:not([data-tagall-processed])')];
    if (!cards.length) return;

    // Помечаем сразу, синхронно — до await, иначе повторный вызов rehydrateOnChanges (например,
    // от собственной подгрузки карточек) успеет обработать те же карточки ещё раз
    cards.forEach((card) => {
      card.dataset.tagallProcessed = '1';
    });

    let createdByByTaskId = {};
    if (authorOnly) {
      try {
        const taskIds = cards.map((card) => card.closest('.main-kanban-item[data-id]')?.dataset.id).filter(Boolean);
        const tasks = await bitrixApi.getTasksByIdsBatch(taskIds, ['ID', 'CREATED_BY']);
        createdByByTaskId = Object.fromEntries(taskIds.map((taskId) => [taskId, tasks[taskId]?.createdBy]));

        const unresolvedUserIds = [...new Set(Object.values(createdByByTaskId).filter(Boolean))];
        await Promise.all(unresolvedUserIds.map((userId) => resolveUserName(bitrixApi, userId, userNameCache)));
      } catch (error) {
        console.warn(error);
      }
    }

    cards.forEach((card) => {
      const taskId = card.closest('.main-kanban-item[data-id]')?.dataset.id;
      if (!taskId) return;

      const control = card.querySelector('.tasks-kanban-item-control');
      if (!control) return;

      const createdBy = createdByByTaskId[taskId];
      // Постановщик не определён (ошибка запроса или задача без CREATED_BY) — тегать некого
      if (authorOnly && !createdBy) return;

      const userName = authorOnly ? userNameCache.get(createdBy) : '';
      const commentText = authorOnly
        ? getTagallCommentText(commentSuffix, `[USER=${createdBy}]${userName}[/USER]`)
        : getTagallCommentText(commentSuffix);
      // В интерфейсе показываем имя, а не BBCode-обёртку вокруг него: она нужна только редактору
      const displayText = authorOnly ? getTagallCommentText(commentSuffix, userName) : commentText;

      const button = Object.assign(document.createElement('button'), {
        className: 'tagall-button',
        type: 'button',
        title: `Опубликовать комментарий: «${displayText}»`,
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
          showToast({severity: 'success', summary: 'Комментарий опубликован', detail: displayText, life: 3000});
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

// Вставляем через мост в main world: только сам редактор умеет разобрать BBCode упоминания
// ([USER=123]Имя[/USER]) и зарегистрировать его у себя — вставленный со стороны текст остался бы
// в комментарии тегом как есть. Фолбэк на случай, когда моста не хватило: rich-text iframe
// (Bitrix "LHE"-редактор) и execCommand в его contentDocument, тот же приём, что использует сам
// редактор для bold/italic.
//
// В фолбэк уходит displayText — с именем вместо BBCode. Упоминания из него не выйдет, зато и
// разметки в опубликованном комментарии не будет: execCommand кладёт строку как обычный текст,
// и в визуальном режиме [USER=123] уехало бы в комментарий буквально. По нему же идёт проверка
// на повторную вставку: сравнивать надо с тем, что видно в редакторе, — если мост успел вставить
// упоминание и лишь потом отвалился по таймауту, в iframe лежит отрисованное имя, и проверка
// сойдётся, а не добавит текст вторым куском.
async function insertTextIntoEditor(form, text, displayText) {
  if (await insertCommentText(form, text)) return;

  const iframeDocument = form.querySelector('.bx-editor-iframe')?.contentDocument;
  if (!iframeDocument?.body) return;

  if (iframeDocument.body.textContent.includes(displayText)) return;

  iframeDocument.body.focus();
  iframeDocument.execCommand('insertText', false, displayText);
}

/**
 * Текст кнопки «готово, можно проверять» из пользовательского шаблона. Ссылки в описании может
 * не быть — тогда переменная уходит вместе с прилегающими разделителями. Шаблон при этом может
 * свестись к пустой строке (например, если он состоит из одной переменной), и это валидный ответ:
 * вставлять нечего, кнопку показывать не за чем.
 */
function renderReviewText(template, link) {
  const source = template?.trim() || DEFAULT_REVIEW_TEMPLATE;

  // Ссылка подставляется функцией, а не строкой: в строке замены `$&`, `$'` и прочие `$`-подстановки
  // раскрылись бы, а в адресе `$` — обычный символ
  if (link) return source.replace(REVIEW_LINK_PLACEHOLDER_RE, () => link).trim();

  return source.replace(REVIEW_LINK_WITH_SEPARATORS_RE, ' ').trim();
}

async function setupTaskCommentButton(bitrixApi, options) {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const commentsBlock = document.querySelector('.feed-comments-block');
  if (!commentsBlock) return;

  const commentSuffix = options?.tagallButtonSuffix;
  const authorOnly = options?.tagallButtonAuthorOnly;
  const withReviewButton = options?.tagallButtonReview;

  let mention = '';
  // Имя постановщика без BBCode-обёртки: та нужна только редактору, в интерфейсе показываем имя
  let mentionName = '';
  let description = '';

  // Постановщик нужен обеим кнопкам, которые его тегают, описание — только кнопке «можно проверять»
  if (authorOnly || withReviewButton) {
    try {
      const select = withReviewButton ? ['CREATED_BY', 'DESCRIPTION'] : ['CREATED_BY'];
      const {data} = await bitrixApi.getTask(ids.taskId, select);
      const createdBy = data?.result?.task?.createdBy;
      description = data?.result?.task?.description ?? '';

      if (createdBy) {
        const userName = await resolveUserName(bitrixApi, createdBy);
        mention = `[USER=${createdBy}]${userName}[/USER]`;
        mentionName = userName;
      }
    } catch (error) {
      console.warn(error);
    }
  }

  const buttons = [];

  // Постановщик не определён (ошибка запроса или задача без CREATED_BY) — тегать некого
  if (!authorOnly || mention) {
    buttons.push({
      icon: 'pi-check-circle',
      text: authorOnly ? getTagallCommentText(commentSuffix, mention) : getTagallCommentText(commentSuffix),
      displayText: authorOnly ? getTagallCommentText(commentSuffix, mentionName) : getTagallCommentText(commentSuffix),
    });
  }

  if (withReviewButton && mention) {
    const reviewText = renderReviewText(options?.tagallButtonReviewText, getFirstLink(description));
    // Пустой шаблон в getTagallCommentText нельзя: он подставил бы свой фолбэк «на проде», и кнопка
    // «готово, можно проверять» вставила бы совсем не тот комментарий
    if (reviewText) {
      buttons.push({
        icon: 'pi-eye',
        text: getTagallCommentText(reviewText, mention),
        displayText: getTagallCommentText(reviewText, mentionName),
      });
    }
  }

  if (!buttons.length) return;

  function addCommentButtons() {
    // .bx-b-pixeplus-tag-all — нативная кнопка тегания всех участников в тулбаре редактора комментария,
    // рядом с ней располагаем свои
    const tagAllIcons = commentsBlock.querySelectorAll('.bx-b-pixeplus-tag-all');

    tagAllIcons.forEach((tagAllIcon) => {
      const toolbarItem = tagAllIcon.closest('.main-post-form-toolbar-button');
      if (!toolbarItem || toolbarItem.dataset.tagallCommentProcessed) return;

      toolbarItem.dataset.tagallCommentProcessed = '1';

      const form = toolbarItem.closest('.feed-add-post');
      if (!form) return;

      // Каждая следующая кнопка встаёт за предыдущей — иначе порядок в тулбаре был бы обратным
      let previousElement = toolbarItem;

      buttons.forEach(({icon, text, displayText}) => {
        const button = Object.assign(document.createElement('div'), {
          className: 'tagall-comment-button',
          title: `Вставить «${displayText}»`,
          innerHTML: `<i class="pi ${icon}"></i>`,
        });

        button.addEventListener('click', (event) => {
          event.stopPropagation();
          insertTextIntoEditor(form, text, displayText).catch((error) => console.warn(error));
        });

        previousElement.insertAdjacentElement('afterend', button);
        previousElement = button;
      });
    });
  }

  addCommentButtons();
  rehydrateOnChanges(addCommentButtons, commentsBlock);
}
