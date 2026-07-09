import BitrixApi from '../../BitrixApi.js';
import {NOTIF_CHANGE_RE, NOTIF_CLOSE_RE, NOTIF_NEW_TASK_RE, NOTIF_REACTION_RE} from '../../patterns.js';
import {getTaskIdFromUrl, rehydrateOnChanges, triggerScrollLoadMore} from '../../utils.js';

// Bitrix убирает удалённые уведомления из списка не сразу после ответа im.notify.delete (сам
// REST-вызов идёт в обход штатного action у Bitrix, поэтому реактивно список обновляется только
// когда до фронтенда долетит pull-событие) — несколько попыток с паузами вместо одной сразу после ответа
async function nudgeLoadMoreAfterDeletion(container) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
     
    await new Promise((resolve) => setTimeout(resolve, 600));
    triggerScrollLoadMore(container);
  }
}

export function removeSystemNotifications(sessionId, options = {}) {
  const {
    removeSystemNotificationsDedupe: dedupe = false,
    removeSystemNotificationsSystem: removeSystem = false,
    removeSystemNotificationsChanges: removeChanges = false,
    removeSystemNotificationsClosed: removeClosed = false,
    removeSystemNotificationsNew: removeNew = false,
    removeSystemNotificationsReactions: removeReactions = false,
  } = options;

  if (!dedupe && !removeSystem && !removeChanges && !removeClosed && !removeNew && !removeReactions) return;

  const bitrixApi = new BitrixApi(sessionId);

  function init() {
    const container = document.querySelector('.bx-im-content-notification__container');
    if (!container) return;

    const buttonContainer = container.querySelector('.bx-im-content-notification__header-buttons-container');
    if (!buttonContainer) return;

    const notificationsContainer = container.querySelector('.bx-im-content-notification__elements');
    if (!notificationsContainer) return;

    const initialized = !!buttonContainer.querySelector('.js-remove-system-notifications');
    if (initialized) return;

    const button = Object.assign(document.createElement('button'), {
      type: 'button',
      textContent: 'Удалить системные уведомления',
      className: 'remove-notifications js-remove-system-notifications',
      async onclick() {
        const allNotifications = [...notificationsContainer.querySelectorAll('.bx-im-content-notification-item__container[data-id]:not([data-id=""])')];

        const systemIds = allNotifications
          .filter((notification) => {
            // Если вместо аватарки серый колокольчик (в новых версиях синяя системная иконка)
            if (removeSystem && notification.querySelector('.bx-im-content-notification-item-avatar__system-icon')) return true;

            const notificationText = notification.querySelector('.bx-im-content-notification-item-content__content-text')?.textContent?.trim();
            if (removeChanges && NOTIF_CHANGE_RE.test(notificationText)) return true;
            if (removeClosed && NOTIF_CLOSE_RE.test(notificationText)) return true;
            if (removeNew && NOTIF_NEW_TASK_RE.test(notificationText)) return true;
            if (removeReactions && NOTIF_REACTION_RE.test(notificationText)) return true;

            return false;
          })
          .map((notification) => notification.getAttribute('data-id'));

        const dedupeIds = [];
        if (dedupe) {
          const seen = new Set();
          for (const notification of allNotifications) {
            const id = notification.getAttribute('data-id');
            if (systemIds.includes(id)) continue;

            const taskLink = notification.querySelector('a[href*="/tasks/task/view/"]');
            const ids = getTaskIdFromUrl(taskLink?.getAttribute('href') ?? '');
            if (!ids) continue;

            const {taskId} = ids;
            if (seen.has(taskId)) {
              dedupeIds.push(id);
            } else {
              seen.add(taskId);
            }
          }
        }

        const toDelete = [...new Set([...systemIds, ...dedupeIds])];
        if (!toDelete.length) return;

        this.setAttribute('disabled', '');
        try {
          await bitrixApi.removeNotifications(toDelete);

          // Не дожидаемся — список подтягивается в фоне, кнопке это ждать незачем
          nudgeLoadMoreAfterDeletion(notificationsContainer);

          this.textContent = 'Уведомления успешно удалены';
          this.classList.add('remove-notifications--success');

          setTimeout(() => {
            this.removeAttribute('disabled');
            this.textContent = 'Удалить системные уведомления';
            this.classList.remove('remove-notifications--success');
          }, 1000);
        } catch {
          this.textContent = 'Ошибка при удалении';
          setTimeout(() => {
            this.removeAttribute('disabled');
            this.textContent = 'Удалить системные уведомления';
          }, 2000);
        }
      },
    });

    buttonContainer.appendChild(button);
    buttonContainer.classList.add('gap-3');
  }

  rehydrateOnChanges(
    init,
    document.body,
    {
      filterMutation: (mutation) => mutation.target.closest('.bx-im-messenger__slider'),
    },
  );
}
