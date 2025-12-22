import {getGroupIdFromUrl, getTaskAndGroupIdsFromUrl, rehydrateOnChanges} from '../../utils.js';

(() => {
  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId && !ids?.taskId) return;

  const metaTitle = document.querySelector('title');
  if (!metaTitle) return;

  const groupName = document.querySelector('.task-group-field-inner a')?.textContent?.trim()
    || document.querySelector('.profile-menu-name')?.textContent?.trim();
  if (!groupName) return;

  function updateTitle() {
    if (metaTitle.textContent.includes(groupName)) return;

    metaTitle.textContent += ` | ${groupName}`;
  }

  updateTitle();

  rehydrateOnChanges(updateTitle, document.querySelector('title'));
})();
