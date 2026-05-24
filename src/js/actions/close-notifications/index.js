import {isUserMentioned, rehydrateOnChanges} from '../../utils.js';

export function closeNotifications(firstName, lastName) {
  if (!firstName || !lastName) return;

  async function closeVisibleNotifications() {
    const notifications = document.querySelectorAll('.ui-notification-manager-browser-balloon:not(.js-notification-processed)');
    for (const notification of notifications) {
      notification.classList.add('js-notification-processed');
    }

    // Ждём макротаск — Bitrix рендерит текст асинхронно после добавления элемента в DOM
    await new Promise((r) => setTimeout(r, 0));

    for (const notification of notifications) {
      const notificationTextElement = notification.querySelector('.ui-notification-manager-browser-text');
      if (!notificationTextElement) continue;

      const notificationText = notificationTextElement.textContent.trim();
      if (isUserMentioned(notificationText, firstName, lastName)) continue;

      if (!notificationText.includes('комментарий к задаче [#')) continue;

      notification.querySelector('.ui-notification-manager-browser-button-close')?.click();
    }
  }

  rehydrateOnChanges(
    closeVisibleNotifications,
    document.body,
    {
      filterMutation: (mutation) => mutation.type === 'childList'
        && mutation.target === document.body
        && Array.from(mutation.addedNodes).some((el) => el.classList?.contains('ui-notification-manager-browser-balloon')),
    },
  );
}
