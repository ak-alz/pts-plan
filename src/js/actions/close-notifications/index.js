import BitrixApi from '../../BitrixApi.js';
import {onNewNotificationBalloon} from '../../notificationBalloons.js';
import {NOTIF_BALLOON_ID_RE, NOTIF_TASK_ID_RE} from '../../patterns.js';
import {isUserMentioned, markTagallAndMentions} from '../../utils.js';

const PROCESSED_CLASS = 'js-notification-processed';
const CLOSE_BUTTON_SELECTOR = '.ui-notification-manager-browser-button-close';
// Иконка уведомлений в боковой панели: счётчик — отдельный элемент внутри неё, и при нулевом
// значении его в DOM нет вовсе, поэтому наблюдаем за самой иконкой, а не за счётчиком
const COUNTER_ICON_SELECTOR = '.bx-im-compact-navigation__icon .ui-icon-set.--o-notification';
const COUNTER_ICON_CONTAINER_CLASS = 'bx-im-compact-navigation__icon';
// Запасной выход, если счётчик так и не дёрнулся: он мог обновиться ещё до появления уведомления
// (тогда ждать уже нечего) или не обновиться совсем
const COUNTER_UPDATE_TIMEOUT_MS = 3000;

function applyTextTransform(textElement, firstName, lastName) {
  textElement.innerHTML = markTagallAndMentions(textElement.innerHTML, firstName, lastName);
}

// ID уведомления лежит не отдельным атрибутом, а внутри id вспомогательных элементов баллона
// (кнопка «Ответить», поле ответа). У уведомлений без таких элементов ID не найдётся — тогда
// уведомление просто закрывается без отметки о прочтении
function getNotificationId(notification) {
  const element = notification.querySelector('[id*="im_notify-"]');
  return element?.id.match(NOTIF_BALLOON_ID_RE)?.[1] ?? null;
}

/**
 * Ждёт, пока Bitrix обновит счётчик непрочитанных у иконки уведомлений. Счётчик увеличивается не
 * в момент показа уведомления, а когда его дообработает pull-канал: отметить прочитанным раньше
 * этого момента бесполезно — инкремент перетрёт отметку, и счётчик вернётся назад.
 * Иконку могли не найти (другая раскладка панели, ещё не отрисована) — тогда просто выжидаем
 * тот же срок вслепую, это по-прежнему лучше, чем отметить мгновенно.
 * @returns {Promise<void>} Разрешается по изменению счётчика или по истечении запасного таймаута.
 */
function waitForCounterUpdate() {
  const container = document.querySelector(COUNTER_ICON_SELECTOR)?.closest(`.${COUNTER_ICON_CONTAINER_CLASS}`);

  return new Promise((resolve) => {
    let timeoutId = null;

    const finish = () => {
      clearTimeout(timeoutId);
      observer?.disconnect();
      resolve();
    };

    const observer = container ? new MutationObserver(finish) : null;
    observer?.observe(container, {childList: true, subtree: true, characterData: true});
    timeoutId = setTimeout(finish, COUNTER_UPDATE_TIMEOUT_MS);
  });
}

export function closeNotifications(sessionId, firstName, lastName, options = {}) {
  if (!firstName || !lastName) return;

  const transformText = !!options.closeNotificationsTransformText;
  const markRead = !!options.closeNotificationsMarkRead;
  const markTaskViewed = !!options.closeNotificationsMarkTaskViewed;
  const bitrixApi = markRead || markTaskViewed ? new BitrixApi(sessionId) : null;

  onNewNotificationBalloon(PROCESSED_CLASS, ({notification, textElement, text}) => {
    if (isUserMentioned(text, firstName, lastName)) {
      if (transformText && textElement) applyTextTransform(textElement, firstName, lastName);
      return;
    }

    // ID читаем до клика: закрытие убирает баллон из DOM вместе с элементами, где он зашит
    const notificationId = markRead ? getNotificationId(notification) : null;
    // Ссылки на задачу во всплывающем уведомлении нет — только её номер в тексте
    const taskId = markTaskViewed ? text.match(NOTIF_TASK_ID_RE)?.[1] ?? null : null;

    notification.querySelector(CLOSE_BUTTON_SELECTOR)?.click();

    // Фоновые операции: пользователь уже увидел закрытое уведомление, ошибку показывать нечем
    // и незачем — счётчик у колокольчика просто останется прежним
    if (notificationId) {
      waitForCounterUpdate()
        .then(() => bitrixApi.markNotificationRead(notificationId))
        .catch((error) => console.warn('[pts-plan] close-notifications', error));
    }

    // Пометка о новых комментариях у самой задачи — иначе она осталась бы висеть в списке задач
    // после того, как уведомление уже закрыто
    if (taskId) {
      bitrixApi.markTaskViewed(taskId).catch((error) => console.warn('[pts-plan] close-notifications', error));
    }
  });
}
