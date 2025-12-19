import BitrixApi from '../../BitrixApi.js';
import { getTaskAndGroupIdsFromUrl } from '../../utils.js';

(() => {
  // TODO: 1. Загружать комментарии на той же странице, а не в новой
  //  2. Добавить возможность подгружать выбранное кол-во страниц или хотя бы по 50
  function init() {
    const ids = getTaskAndGroupIdsFromUrl(window.location.href);
    if (!ids?.groupId || !ids?.taskId) return;

    const buttonContainer = document.querySelector('.feed-com-header');
    if (!buttonContainer) return;

    const initialized = !!document.querySelector('.js-show-comments');
    if (initialized) return;

    const button = Object.assign(document.createElement('a'), {
      className: 'js-show-comments feed-com-all',
      href: BitrixApi.getTaskCommentsUrl(ids.groupId, ids.taskId),
      textContent: 'Загрузить все комментарии',
    });

    buttonContainer.appendChild(button);
    buttonContainer.classList.add('gap-3');
  }

  init();
})();
