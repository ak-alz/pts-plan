import BitrixApi from '../../BitrixApi.js';
import {rehydrateOnChanges} from '../../utils.js';

export function removeSystemNotifications(sessionId) {
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
        const notifications = [...notificationsContainer.querySelectorAll('.bx-im-content-notification-item__container[data-id]:not([data-id=""])')]
          .filter((notification) => {
            // Если вместо аватарки серый колокольчик
            if (notification.querySelector('.bx-im-content-notification-item-avatar__system-icon')) return true;

            const notificationText = notification.querySelector('.bx-im-content-notification-item-content__content-text')?.textContent?.trim();
            return /^(Изменила?|Закрыла?) задачу \[#/.test(notificationText);
          })
          .map((notification) => notification.getAttribute('data-id'));

        if (!notifications.length) return;

        this.setAttribute('disabled', '');
        await bitrixApi.removeNotifications(notifications);

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
    (mutation) => mutation.target.closest('.bx-im-messenger__slider'),
  );
}
