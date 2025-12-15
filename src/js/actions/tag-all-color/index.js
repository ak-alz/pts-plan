import { getTaskAndGroupIdsFromUrl, insertCSS, validateHexColor } from '../../utils.js';

export function tagAllColor(color) {
  if (!validateHexColor(color)) return;

  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const className = 'tag-all-highlight';

  const comments = document.querySelectorAll('.feed-com-text-inner-inner');
  if (!comments.length) return;

  const regex = /\bTAGALL\b/gi;

  let hasMatches = false;

  comments.forEach((comment) => {
    if (regex.test(comment.textContent)) {
      hasMatches = true;

      comment.innerHTML = comment.innerHTML.replace(regex, (match) => `<b class="${className}">${match}</b>`);
    }
  });

  if (hasMatches) {
    const css = `.${className} {
      color: ${color} !important;
    }`;

    insertCSS(css);
  }
}
