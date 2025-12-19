import {getTaskAndGroupIdsFromUrl, rehydrateOnChanges} from '../../utils.js';

(() => {
  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  if (!ids?.taskId) return;

  function fix() {
    const links = document.querySelectorAll('.task-detail-description a:not(.js-link-fixed), .feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner a:not(.js-link-fixed)');
    links.forEach((link) => {
      if (link.textContent.includes('...')) {
        link.classList.add('js-link-fixed');
        link.textContent = link.href;
      }
    });
  }

  fix();

  rehydrateOnChanges(
    fix,
    document.querySelector('.feed-comments-block'),
    (mutation) => !mutation.target.closest('.feed-com-add-box-outer'),
  );
})();
