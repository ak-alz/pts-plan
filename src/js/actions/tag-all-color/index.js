import {getTaskAndGroupIdsFromUrl, insertCSS, rehydrateOnChanges, validateHexColor} from '../../utils.js';

export function tagAllColor(color) {
  if (!validateHexColor(color)) return;

  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const className = 'tag-all-highlight';

  const css = `.${className} {
    color: ${color};
  }`;

  // Заранее вставляем стили на сайт, даже если TAGALL еще не было - на будущее
  insertCSS(css);

  const regex = /\bTAGALL\b/gi;

  function highlight() {
    const comments = document.querySelectorAll('.feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner');
    if (!comments.length) return;

    comments.forEach((comment) => {
      if (regex.test(comment.textContent)) {
        comment.innerHTML = comment.innerHTML.replace(regex, (match) => `<b class="${className}">${match}</b>`);
      }
    });
  }

  highlight();

  rehydrateOnChanges(
    highlight,
    document.querySelector('.feed-comments-block'),
    {
      filterMutation: (mutation) => !mutation.target.closest('.feed-com-add-box-outer'),
    },
  );
}
