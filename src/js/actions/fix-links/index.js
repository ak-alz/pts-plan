import { getTaskAndGroupIdsFromUrl } from '../../utils.js';

(() => {
  function init() {
    const ids = getTaskAndGroupIdsFromUrl(window.location.href);
    if (!ids?.groupId || !ids?.taskId) return;

    const links = document.querySelectorAll('.task-detail-description a, .feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner a');
    links.forEach((link) => {
      if (link.textContent.includes('...')) {
        link.textContent = link.href;
      }
    });
  }

  init();
})();
