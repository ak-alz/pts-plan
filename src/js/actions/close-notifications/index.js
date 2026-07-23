import {onNewNotificationBalloon} from '../../notificationBalloons.js';
import {isUserMentioned, markTagallAndMentions} from '../../utils.js';

const PROCESSED_CLASS = 'js-notification-processed';
const CLOSE_BUTTON_SELECTOR = '.ui-notification-manager-browser-button-close';

function applyTextTransform(textElement, firstName, lastName) {
  textElement.innerHTML = markTagallAndMentions(textElement.innerHTML, firstName, lastName);
}

export function closeNotifications(firstName, lastName, options = {}) {
  if (!firstName || !lastName) return;

  const transformText = !!options.closeNotificationsTransformText;

  onNewNotificationBalloon(PROCESSED_CLASS, ({notification, textElement, text}) => {
    if (isUserMentioned(text, firstName, lastName)) {
      if (transformText && textElement) applyTextTransform(textElement, firstName, lastName);
      return;
    }

    notification.querySelector(CLOSE_BUTTON_SELECTOR)?.click();
  });
}
