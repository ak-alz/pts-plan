import {getGroupIdFromUrl, rehydrateOnChanges} from '../../utils.js';

(() => {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  const metaTitle = document.querySelector('title');
  if (!metaTitle) return;

  const groupName = document.querySelector('.profile-menu-name')?.textContent?.trim();
  if (!groupName) return;

  function updateTitle() {
    if (metaTitle.textContent.includes(groupName)) return;

    metaTitle.textContent += ` | ${groupName}`;
  }

  updateTitle();

  rehydrateOnChanges(updateTitle, document.querySelector('title'));
})();
