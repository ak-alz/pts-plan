import {BROWSER_NOTIFICATION_MESSAGE_TYPE} from '../../messages.js';
import {onNewNotificationBalloon} from '../../notificationBalloons.js';
import {NOTIF_TASK_ID_RE} from '../../patterns.js';
import {getTaskUrl, isUserMentioned} from '../../utils.js';

const PROCESSED_CLASS = 'js-pts-browser-processed';

export function browserNotifications(options = {}) {
  // Без имени/фамилии isUserMentioned всегда вернёт false — фильтр в этом случае отключаем,
  // а не молча блокируем все уведомления
  const showOwnOnly = !!(options.browserNotificationsOwnOnly && options.userFirstName && options.userLastName);

  // Всплывающее уведомление не содержит ссылки на задачу, только её ID в тексте вида "[#481203]".
  // Group ID неизвестен, но getTaskUrl резолвит задачу по любому userId — свой userId всегда под рукой
  function extractTaskUrl(text) {
    const taskId = text.match(NOTIF_TASK_ID_RE)?.[1];
    if (!taskId || !options.userId) return null;

    const path = getTaskUrl(null, taskId, options.userId);
    return path ? new URL(path, window.location.origin).href : null;
  }

  onNewNotificationBalloon(PROCESSED_CLASS, ({notification, text}) => {
    if (showOwnOnly && !isUserMentioned(text, options.userFirstName, options.userLastName)) return;

    const titleElement = notification.querySelector('.ui-notification-manager-browser-title');
    const title = titleElement?.textContent.trim() || 'Bitrix24';

    // Если задачу не удалось определить, кликом по браузерному уведомлению возвращаемся на текущую страницу
    const url = extractTaskUrl(text) ?? window.location.href;

    // Один и тот же баллон Bitrix одновременно приходит во все открытые вкладки — по этому ключу
    // фоновый скрипт схлопывает повторы в одно системное уведомление вместо N дублей
    const dedupeKey = `${title}::${text}`;

    chrome.runtime.sendMessage({
      type: BROWSER_NOTIFICATION_MESSAGE_TYPE,
      title,
      message: text,
      url,
      dedupeKey,
      silent: !!options.browserNotificationsSilent,
    });
  });
}
