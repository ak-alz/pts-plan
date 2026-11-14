import {TAGALL_TOKEN, TAGALL_WORD_RE} from './patterns.js';
import {rehydrateOnChanges} from './utils.js';

export const TAGALL_MARK_CLASS = 'tag-all-highlight';

const COMMENT_TEXT_SELECTOR = '.feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner';

let isInitialized = false;

// Оборачиваются текстовые узлы, а не переписывается innerHTML: пересборка разметки комментария сняла бы
// обработчики с его картинок и ссылок (кнопки image-actions после этого не нажимались). Заодно
// совпадение не может оказаться внутри атрибута, а граница слова у <br> получается сама — текст
// по обе стороны от тега лежит в разных узлах
function markComment(comment) {
  // Быстрый выход — по подстроке, а не по слову: textContent склеивает соседние узлы без разделителя,
  // и «TAGALL<br>1. Готово» в нём выглядит как «TAGALL1. Готово», где границы слова уже нет
  if (comment.querySelector(`.${TAGALL_MARK_CLASS}`) || !comment.textContent.includes(TAGALL_TOKEN)) return;

  const walker = document.createTreeWalker(comment, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((textNode) => {
    let rest = textNode;
    let match = TAGALL_WORD_RE.exec(rest.data);

    while (match) {
      const word = rest.splitText(match.index);
      rest = word.splitText(match[0].length);

      const mark = document.createElement('span');
      mark.className = TAGALL_MARK_CLASS;
      word.replaceWith(mark);
      mark.append(word);

      match = TAGALL_WORD_RE.exec(rest.data);
    }
  });
}

function markComments() {
  document.querySelectorAll(COMMENT_TEXT_SELECTOR).forEach(markComment);
}

/**
 * Размечает слово TAGALL в комментариях задачи элементом с классом `TAGALL_MARK_CLASS` и следит за
 * новыми комментариями. Сама разметка ничего не красит — она нужна и фиче, которая задаёт цвет слова
 * (`tag-all-color`), и той, что подсвечивает весь комментарий с обращением (`user-name-color`),
 * поэтому вызывать можно из обеих: наблюдатель заводится один раз.
 */
export function initTagallMarks() {
  if (isInitialized) return;

  const commentsBlock = document.querySelector('.feed-comments-block');
  if (!commentsBlock) return;

  isInitialized = true;
  markComments();

  rehydrateOnChanges(markComments, commentsBlock, {
    filterMutation: (mutation) => !mutation.target.closest('.feed-com-add-box-outer'),
  });
}
