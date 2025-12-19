import {getTaskAndGroupIdsFromUrl, getUserIdFromUrl, rehydrateOnChanges} from '../../utils.js';

(() => {
  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const auditorIds = [...document.querySelectorAll('.task-detail-sidebar-info-user-wrap[data-item-value]:not([data-item-value=""])')]
    .map((el) => el.getAttribute('data-item-value'));

  const maxCheckedSymbols = 100;

  function createWarningIcon(title) {
    return Object.assign(document.createElement('i'), {
      className: 'pi pi-exclamation-circle text-red-400',
      title,
    });
  }

  function highlight() {
    const comments = document.querySelectorAll('.feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner:not(.js-comment-processed)');
    comments.forEach((comment) => {
      comment.classList.add('js-comment-processed');

      const notificationText = comment.textContent.trim().substring(0, maxCheckedSymbols);
      let hasMention = notificationText.includes('TAGALL');

      const mentions = comment.querySelectorAll('a[href*="/company/personal/user/"]');
      mentions.forEach((mention) => {
        const mentionUserId = getUserIdFromUrl(mention.href);
        if (!mentionUserId) return;

        if (auditorIds.includes(mentionUserId)) {
          if (!hasMention && notificationText.includes(mention.textContent.trim())) {
            hasMention = true;
          }
        } else {
          mention.after(' ', createWarningIcon('Пользователь не добавлен в задачу'));
        }
      });

      if (!hasMention) {
        const userBox = comment.closest('.feed-com-block').querySelector('.feed-com-user-box');
        if (userBox) {
          userBox.appendChild(createWarningIcon(`В первых ${maxCheckedSymbols} символах нет обращений`));
        }
      }
    });
  }

  highlight();

  rehydrateOnChanges(
    highlight,
    document.querySelector('.feed-comments-block'),
    (mutation) => !mutation.target.closest('.feed-com-add-box-outer'),
  );
})();
