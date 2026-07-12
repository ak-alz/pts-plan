import {getGroupIdFromUrl, getTaskIdFromUrl, getUserIdFromUrl} from '../../utils.js';

export function openInNewTab(options) {
  if (options.openInNewTabEdit ?? true) {
    const editLink = document.querySelector('a.task-view-button.edit');
    if (editLink) {
      editLink.target = '_blank';
    }
  }

  if (options.openInNewTabCreate ?? true) {
    const createButton = document.querySelector('#tasks-buttonAdd .ui-btn-main');
    if (createButton) {
      createButton.addEventListener('click', (e) => {
        const groupId = getGroupIdFromUrl(window.location.href);
        const userId = getUserIdFromUrl(window.location.href);

        if (!groupId && !userId) return;

        e.stopImmediatePropagation();

        if (groupId) {
          window.open(`/workgroups/group/${groupId}/tasks/task/edit/0/`, '_blank');
        } else {
          window.open(`/company/personal/user/${userId}/tasks/task/edit/0/`, '_blank');
        }
      }, true);
    }
  }

  if (options.openInNewTabCopy || options.openInNewTabSubtask) {
    if (!getTaskIdFromUrl(window.location.href)) return;

    document.addEventListener('click', (e) => {
      const match = window.location.href.match(/^(.*\/tasks\/task\/)view\/(\d+)\//);
      if (!match) return;

      const [, basePath, taskId] = match;

      if (options.openInNewTabCopy && e.target.closest('.menu-popup-item-copy')) {
        e.stopImmediatePropagation();
        window.open(`${basePath}edit/0/?_COPY=${taskId}&SOURCE=view`, '_blank');
      }

      if (options.openInNewTabSubtask && e.target.closest('.menu-popup-item-create')) {
        e.stopImmediatePropagation();
        window.open(`${basePath}edit/0/?PARENT_ID=${taskId}&SOURCE=view`, '_blank');
      }
    }, true);
  }
}
