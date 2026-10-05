import {REPEATED_LINE_BREAKS_RE} from '../../patterns.js';
import {rehydrateOnChanges} from '../../utils.js';

const TOOLBAR_SELECTOR = '.main-post-form-toolbar-buttons-container';
const EDITOR_IFRAME_SELECTOR = '.bxhtmled-iframe-cnt iframe';
const EDITOR_TEXTAREA_SELECTOR = '.bxhtmled-textarea';

function cleanText(text) {
  return text.replace(REPEATED_LINE_BREAKS_RE, '\n');
}

// Визуальный режим: Enter даёт <br>, правим прямо DOM — так упоминания (span с bxid, чей ID
// пользователя живёт только в JS-объекте редактора) остаются нетронутыми. GetContent() редактора
// читает DOM заново, отдельной синхронизации не нужно
function cleanEditorBody(body) {
  body.querySelectorAll('br').forEach((lineBreak) => {
    const whitespaceNodes = [];
    let previous = lineBreak.previousSibling;
    while (previous?.nodeType === Node.TEXT_NODE && !previous.textContent.trim()) {
      whitespaceNodes.push(previous);
      previous = previous.previousSibling;
    }
    if (previous?.nodeName !== 'BR') return;

    // Пробелы между переносами — это та же пустая строка: без них пробел прилипал бы к следующей
    whitespaceNodes.forEach((node) => node.remove());
    lineBreak.remove();
  });
}

// Чистим оба представления: текущий режим редактора из isolated world не узнать, а неактивное
// при переключении режима всё равно перезапишется из активного
function cleanComment(form) {
  const textarea = form.querySelector(EDITOR_TEXTAREA_SELECTOR);
  if (textarea) textarea.value = cleanText(textarea.value);

  const body = form.querySelector(EDITOR_IFRAME_SELECTOR)?.contentDocument?.body;
  if (body) cleanEditorBody(body);
}

export function cleanCommentButton() {
  const commentsBlock = document.querySelector('.feed-comments-block');
  if (!commentsBlock) return;

  function addButtons() {
    commentsBlock.querySelectorAll(TOOLBAR_SELECTOR).forEach((toolbar) => {
      if (toolbar.dataset.cleanCommentProcessed) return;
      toolbar.dataset.cleanCommentProcessed = '1';

      const form = toolbar.closest('.feed-add-post');
      if (!form) return;

      const button = Object.assign(document.createElement('div'), {
        className: 'tagall-comment-button',
        title: 'Почистить текст комментария: несколько переносов строк подряд схлопнуть в один',
        innerHTML: '<i class="pi pi-eraser"></i>',
      });

      button.addEventListener('click', (event) => {
        event.stopPropagation();
        cleanComment(form);
      });

      toolbar.appendChild(button);
    });
  }

  addButtons();
  rehydrateOnChanges(addButtons, commentsBlock);
}
