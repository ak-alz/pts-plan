import {rehydrateOnChanges} from '../../utils.js';

export function closeNotifications(firstName, lastName) {
  if (!firstName || !lastName) return;

  function close() {
    const notifications = document.querySelectorAll('.ui-notification-manager-browser-balloon:not(.js-notification-processed)');
    notifications.forEach((notification) => {
      notification.classList.add('js-notification-processed');

      const notificationTextElement = notification.querySelector('.ui-notification-manager-browser-text');
      if (!notificationTextElement) return;

      const notificationText = notificationTextElement.textContent.trim();
      if (notificationText.includes('TAGALL')) return;

      if (notificationText.includes(`${firstName} ${lastName}`)) return;

      if (notificationText.includes(`${lastName} ${firstName}`)) return;

      if (!notificationText.includes('комментарий к задаче [#')) return;

      const deleteButton = notification.querySelector('.ui-notification-manager-browser-button-close');
      deleteButton && deleteButton.click();
    });
  }

  rehydrateOnChanges(
    close,
    document.body,
    {
      filterMutation: (mutation) => mutation.type === 'childList'
        && mutation.target === document.body
        && Array.from(mutation.addedNodes).some((el) => el.classList?.contains('ui-notification-manager-browser-balloon')),
    },
  );
}
