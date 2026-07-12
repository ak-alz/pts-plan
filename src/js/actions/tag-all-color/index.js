import {TAGALL_WORD_RE} from '../../patterns.js';
import {getTaskIdFromUrl, insertCSS, rehydrateOnChanges, validateHexColor} from '../../utils.js';

export function tagAllColor(color) {
  if (!validateHexColor(color)) return;

  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const className = 'tag-all-highlight';

  const css = `.${className} {
    color: ${color};
  }`;

  // Заранее вставляем стили на сайт, даже если TAGALL еще не было - на будущее
  insertCSS(css);

  function highlightTagAll() {
    const comments = document.querySelectorAll('.feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner');
    if (!comments.length) return;

    comments.forEach((comment) => {
      if (comment.querySelector(`.${className}`)) return;

      // Проверяем и заменяем одну и ту же строку (innerHTML), а не очищенную от тегов копию —
      // сам символ "<" любого тега после TAGALL уже даёт границу \b (в отличие от textContent,
      // где <br> схлопывается без разделителя и "TAGALL4. Текст" не матчится как отдельное слово)
      if (!TAGALL_WORD_RE.test(comment.innerHTML)) return;

      comment.innerHTML = comment.innerHTML.replace(TAGALL_WORD_RE, (match) => `<b class="${className}">${match}</b>`);
    });
  }

  highlightTagAll();

  rehydrateOnChanges(
    highlightTagAll,
    document.querySelector('.feed-comments-block'),
    {
      filterMutation: (mutation) => !mutation.target.closest('.feed-com-add-box-outer'),
    },
  );
}
