import dayjs from 'dayjs';

import BitrixApi from '../../BitrixApi.js';
import {NOTIF_CHANGE_RE, NOTIF_CLOSE_RE, NOTIF_NEW_TASK_RE, NOTIF_REACTION_RE, TAGALL_STATUS_RE} from '../../patterns.js';
import {showToast} from '../../toastHost/showToast.js';
import {canonicalizeTagallHtml, getTaskIdFromUrl, rehydrateOnChanges, triggerScrollLoadMore} from '../../utils.js';

const TASK_STATUS_CLOSED = 5;

// Bitrix убирает удалённые уведомления из списка не сразу после ответа im.notify.delete (сам
// REST-вызов идёт в обход штатного action у Bitrix, поэтому реактивно список обновляется только
// когда до фронтенда долетит pull-событие) — несколько попыток с паузами вместо одной сразу после ответа
async function nudgeLoadMoreAfterDeletion(container) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (!triggerScrollLoadMore(container)) return;
  }
}

const RELATIVE_DAY_OFFSETS = {'сегодня': 0, 'вчера': -1};
// dayjs 1.11.21's ru-locale MMMM-парсинг (customParseFormat) миспарсит родительный падеж
// декабря на год вперёд — название месяца сверяем сами, dayjs используем только для арифметики
const MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

// Разбирает дату уведомления Bitrix: "сегодня, HH:mm" / "вчера, HH:mm" / "D month, HH:mm".
// Год не указан в тексте — берём текущий, а если результат оказался в будущем, значит речь
// про прошлый год (даты уведомлений не идут вперёд относительно текущего момента)
function parseNotificationDate(text) {
  const match = text?.trim().match(/^(.+?),\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, prefix, hoursText, minutesText] = match;
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const now = dayjs();

  const relativeDayPrefix = prefix.toLowerCase();
  if (relativeDayPrefix in RELATIVE_DAY_OFFSETS) {
    return now.add(RELATIVE_DAY_OFFSETS[relativeDayPrefix], 'day').hour(hours).minute(minutes).second(0).millisecond(0);
  }

  const dayMonthMatch = prefix.match(/^(\d{1,2})\s+([а-яё]+)$/i);
  if (!dayMonthMatch) return null;

  const month = MONTH_NAMES.indexOf(dayMonthMatch[2].toLowerCase());
  if (month === -1) return null;

  const day = Number(dayMonthMatch[1]);
  // date(1) перед month(): без него смена месяца на более короткий при текущем дне >28
  // перескочила бы на следующий месяц ещё до того, как ниже проставится нужный day
  const parsed = now.date(1).month(month).date(day).hour(hours).minute(minutes).second(0).millisecond(0);
  return parsed.isAfter(now) ? parsed.subtract(1, 'year') : parsed;
}

export function removeSystemNotifications(sessionId, options = {}) {
  const {
    removeSystemNotificationsDedupe: dedupe = false,
    removeSystemNotificationsSystem: removeSystem = false,
    removeSystemNotificationsChanges: removeChanges = false,
    removeSystemNotificationsClosed: removeClosed = false,
    removeSystemNotificationsClosedTasks: removeClosedTasks = false,
    removeSystemNotificationsNew: removeNew = false,
    removeSystemNotificationsReactions: removeReactions = false,
    removeSystemNotificationsStatus: removeStatus = false,
  } = options;

  if (!dedupe && !removeSystem && !removeChanges && !removeClosed && !removeClosedTasks && !removeNew && !removeReactions && !removeStatus) return;

  const bitrixApi = new BitrixApi(sessionId);

  // Список выбранных фильтров для title кнопки — по тем же лейблам, что в настройках (options.js)
  const activeFilterLabels = [
    removeSystem && 'системная иконка',
    removeChanges && 'изменения задач',
    removeClosed && 'закрытия задач',
    removeClosedTasks && 'уже закрытые задачи',
    removeNew && 'новые задачи',
    removeReactions && 'реакции',
    removeStatus && 'статусные уведомления',
    dedupe && 'дубли',
  ].filter(Boolean);
  const buttonTitle = activeFilterLabels.length ? `Удаляет: ${activeFilterLabels.join(', ')}` : '';

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
      title: buttonTitle,
      className: 'remove-notifications js-remove-system-notifications',
      async onclick() {
        const allNotifications = [...notificationsContainer.querySelectorAll('.bx-im-content-notification-item__container[data-id]:not([data-id=""])')];

        const systemIds = allNotifications
          .filter((notification) => {
            // Если вместо аватарки серый колокольчик (в новых версиях синяя системная иконка)
            if (removeSystem && notification.querySelector('.bx-im-content-notification-item-avatar__system-icon')) return true;

            const contentElement = notification.querySelector('.bx-im-content-notification-item-content__content-text');
            const notificationText = contentElement?.textContent?.trim();
            if (removeChanges && NOTIF_CHANGE_RE.test(notificationText)) return true;
            if (removeClosed && NOTIF_CLOSE_RE.test(notificationText)) return true;
            if (removeNew && NOTIF_NEW_TASK_RE.test(notificationText)) return true;
            if (removeReactions && NOTIF_REACTION_RE.test(notificationText)) return true;

            if (removeStatus) {
              const canonicalText = contentElement ? canonicalizeTagallHtml(contentElement.innerHTML) : '';
              if (TAGALL_STATUS_RE.test(canonicalText)) return true;
            }

            return false;
          })
          .map((notification) => notification.getAttribute('data-id'));

        // dedupe и removeClosedTasks оба нуждаются в taskId несистемных уведомлений — извлекаем
        // его один раз для обоих фильтров вместо повторного обхода allNotifications и DOM-запросов
        const taskIdByNotification = new Map();
        if (dedupe || removeClosedTasks) {
          for (const notification of allNotifications) {
            const id = notification.getAttribute('data-id');
            if (systemIds.includes(id)) continue;

            const taskLink = notification.querySelector('a[href*="/tasks/task/view/"]');
            const ids = getTaskIdFromUrl(taskLink?.getAttribute('href') ?? '');
            if (ids) taskIdByNotification.set(notification, ids.taskId);
          }
        }

        const dedupeIds = [];
        if (dedupe) {
          const seen = new Set();
          taskIdByNotification.forEach((taskId, notification) => {
            if (seen.has(taskId)) {
              dedupeIds.push(notification.getAttribute('data-id'));
            } else {
              seen.add(taskId);
            }
          });
        }

        this.setAttribute('disabled', '');
        try {
          const closedTaskIds = [];
          if (removeClosedTasks) {
            const uniqueTaskIds = [...new Set(taskIdByNotification.values())];
            const tasks = uniqueTaskIds.length
              ? await bitrixApi.getTasksByIdsBatch(uniqueTaskIds, ['ID', 'STATUS', 'CLOSED_DATE'])
              : {};

            taskIdByNotification.forEach((taskId, notification) => {
              const task = tasks[taskId];
              if (!task || Number(task.status) !== TASK_STATUS_CLOSED || !task.closedDate) return;

              const dateText = notification.querySelector('.bx-im-content-notification-item-content__date')?.textContent;
              const notificationDate = parseNotificationDate(dateText);
              // Уведомление, пришедшее после закрытия задачи, не трогаем — вдруг там важное упоминание
              if (notificationDate && notificationDate.isBefore(task.closedDate)) {
                closedTaskIds.push(notification.getAttribute('data-id'));
              }
            });
          }

          const toDelete = [...new Set([...systemIds, ...dedupeIds, ...closedTaskIds])];
          if (!toDelete.length) {
            this.removeAttribute('disabled');
            showToast({severity: 'info', summary: 'Уведомлений нет', detail: 'Среди видимых уведомлений подходящих не нашлось.', life: 3000});
            return;
          }

          await bitrixApi.removeNotifications(toDelete);

          // Не дожидаемся — список подтягивается в фоне, кнопке это ждать незачем
          nudgeLoadMoreAfterDeletion(notificationsContainer);

          this.textContent = 'Уведомления успешно удалены';
          this.classList.add('remove-notifications--success');
          showToast({severity: 'success', summary: 'Уведомления удалены', detail: `Удалено: ${toDelete.length}`, life: 3000});

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
