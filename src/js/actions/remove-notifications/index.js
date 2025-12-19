import BitrixApi from '../../BitrixApi.js';
import {getTaskAndGroupIdsFromUrl} from '../../utils.js';

export function removeNotifications(sessionId) {
  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const buttonContainer = document.querySelector('.task-detail-extra-right');
  if (!buttonContainer) return;

  const initialized = !!buttonContainer.querySelector('.js-remove-notifications');
  if (initialized) return;

  const bitrixApi = new BitrixApi(sessionId);

  const button = Object.assign(document.createElement('button'), {
    className: 'remove-notifications js-remove-notifications',
    textContent: 'Удалить уведомления',
    async onclick() {
      this.setAttribute('disabled', '');

      let notifications = await BitrixApi.getUserNotifications(ids.taskId);
      if (!notifications.length) {
        this.removeAttribute('disabled');

        return;
      }

      notifications = notifications.map((notification) => {
        return notification.getAttribute('data-id');
      });

      await bitrixApi.removeNotifications(notifications);
      this.textContent = 'Уведомления успешно удалены';
      this.classList.add('remove-notifications--success');

      setTimeout(() => {
        this.removeAttribute('disabled');
        this.textContent = 'Удалить уведомления';
        this.classList.remove('remove-notifications--success');
      }, 1000);
    },
  });

  buttonContainer.prepend(button);
  buttonContainer.classList.add('gap-3');
}
