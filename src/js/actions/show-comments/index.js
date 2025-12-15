import BitrixApi from '../../BitrixApi.js';
import { getTaskAndGroupIdsFromUrl } from '../../utils.js';

(() => {
  function init() {
    const ids = getTaskAndGroupIdsFromUrl(window.location.href);
    if (!ids?.groupId || !ids?.taskId) return;

    const buttonContainer = document.querySelector('.feed-com-header');
    if (!buttonContainer) return;

    const initialized = !!document.querySelector('.js-show-comments');
    if (initialized) return;

    const button = Object.assign(document.createElement('a'), {
      className: 'js-show-comments feed-com-all',
      href: BitrixApi.getTaskCommentsLink(ids.groupId, ids.taskId),
      textContent: 'Загрузить все комментарии',
    });

    buttonContainer.appendChild(button);
    buttonContainer.classList.add('gap-3');
  }

  init();
})();
