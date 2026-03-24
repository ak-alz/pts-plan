import {getGroupIdFromUrl} from '../../utils.js';

(() => {
  const editLink = document.querySelector('a.task-view-button.edit');
  if (editLink) {
    editLink.target = '_blank';
  }

  const createButton = document.querySelector('#tasks-buttonAdd .ui-btn-main');
  if (createButton) {
    createButton.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      const groupId = getGroupIdFromUrl(window.location.href);
      if (groupId) {
        window.open(`/workgroups/group/${groupId}/tasks/task/edit/0/`, '_blank');
      }
    }, true);
  }
})();
