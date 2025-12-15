import {getTaskAndGroupIdsFromUrl, rehydrateOnChanges} from '../../utils.js';

(() => {
  function init() {
    const ids = getTaskAndGroupIdsFromUrl(window.location.href);
    if (!ids?.groupId || !ids?.taskId) return;

    const links = document.querySelectorAll('.task-detail-description a:not(.--fixed), .feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner a:not(.--fixed)');
    links.forEach((link) => {
      if (link.textContent.includes('...')) {
        link.classList.add('--fixed');
        link.textContent = link.href;
      }
    });
  }

  init();

  rehydrateOnChanges(init);
})();
