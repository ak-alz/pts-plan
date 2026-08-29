import {getGroupIdFromUrl, getPersonalPlanUserIdFromUrl, getTaskIdFromUrl, rehydrateOnChanges} from '../../utils.js';

(() => {
  const ids = getTaskIdFromUrl(window.location.href);
  const groupId = getGroupIdFromUrl(window.location.href);
  const isPersonalPlan = !!getPersonalPlanUserIdFromUrl(window.location.href);
  if (!groupId && !ids?.taskId && !isPersonalPlan) return;

  const metaTitle = document.querySelector('title');
  if (!metaTitle) return;

  const groupName = isPersonalPlan
    ? 'Мой план'
    : document.querySelector('.task-group-field-inner a')?.textContent?.trim()
      || document.querySelector('.profile-menu-name')?.textContent?.trim();
  if (!groupName) return;

  function updateTitle() {
    if (metaTitle.textContent.includes(groupName)) return;

    metaTitle.textContent += ` | ${groupName}`;
  }

  updateTitle();

  rehydrateOnChanges(updateTitle, document.querySelector('title'));
})();
