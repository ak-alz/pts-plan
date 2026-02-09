import {getTaskAndGroupIdsFromUrl, rehydrateOnChanges} from '../../utils.js';

(() => {
  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  if (!ids?.taskId) return;

  function autoChoiceUser() {
    const dialogs = document.querySelectorAll('.popup-window.--open .ui-selector-dialog:has(.ui-selector-tab-content-active .ui-selector-item)');
    dialogs.forEach((dialog) => {
      const users = dialog.querySelectorAll('.ui-selector-tab-content-active .ui-selector-item');
      if (users.length === 1) {
        users[0].click();
      }
    });
  }

  rehydrateOnChanges(
    autoChoiceUser,
    document.body,
    {
      filterMutation: (mutation) => mutation.target.closest('.popup-window'),
    },
  );
})();
