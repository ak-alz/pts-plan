import BitrixApi from '../../BitrixApi.js';
import {getTaskAndGroupIdsFromUrl, rehydrateOnChanges} from '../../utils.js';

export function removeSystemNotifications(sessionId, {dedupe = false, removeNew = false, removeReactions = false} = {}) {
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
            if (notification.querySelector('.bx-im-content-notification-item-avatar__system-icon')) return true;

            const notificationText = notification.querySelector('.bx-im-content-notification-item-content__content-text')?.textContent?.trim();
            if (/^((Изменила?|Закрыла?) задачу|Изменена задача) \[#/.test(notificationText)) return true;
            if (removeNew && /^Добавила? новую задачу \[#/.test(notificationText)) return true;
            if (removeReactions && /^Отреагировала? на ваш комментарий/.test(notificationText)) return true;

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
            const ids = getTaskAndGroupIdsFromUrl(taskLink?.getAttribute('href') ?? '');
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
        await bitrixApi.removeNotifications(toDelete);

        this.textContent = 'Уведомления успешно удалены';
        this.classList.add('remove-notifications--success');

        setTimeout(() => {
          this.removeAttribute('disabled');
          this.textContent = 'Удалить системные уведомления';
          this.classList.remove('remove-notifications--success');
        }, 1000);
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
