import BitrixApi from '../../BitrixApi.js';
import {showToast} from '../../toastHost/showToast.js';
import {getTaskIdFromUrl} from '../../utils.js';

export function removeNotifications(sessionId) {
  const ids = getTaskIdFromUrl(window.location.pathname);
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

      let notifications;
      try {
        notifications = await bitrixApi.getTaskNotificationIds(ids.taskId);
        if (notifications.length) await bitrixApi.removeNotifications(notifications);
      } catch (error) {
        console.warn(error);
        this.removeAttribute('disabled');
        showToast({severity: 'error', summary: 'Не удалось удалить уведомления', detail: error.message, life: 5000});

        return;
      }

      if (!notifications.length) {
        this.removeAttribute('disabled');
        showToast({severity: 'info', summary: 'Уведомлений нет', detail: 'Удалять нечего.', life: 3000});

        return;
      }

      this.textContent = 'Уведомления успешно удалены';
      this.classList.add('remove-notifications--success');
      showToast({severity: 'success', summary: 'Уведомления удалены', detail: `Удалено: ${notifications.length}`, life: 3000});

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
