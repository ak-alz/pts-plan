import {NOTIF_TASK_ID_RE, TAGALL_NAMED_RE, TAGALL_TOKEN} from '../../patterns.js';
import {getTaskUrl, isUserMentioned, rehydrateOnChanges, waitForStableText} from '../../utils.js';

export function browserNotifications(options = {}) {
  // Без имени/фамилии isUserMentioned всегда вернёт false — фильтр в этом случае отключаем,
  // а не молча блокируем все уведомления
  const showOwnOnly = !!(options.browserNotificationsOwnOnly && options.userFirstName && options.userLastName);

  // Тост не содержит ссылки на задачу, только её ID в тексте вида "[#481203]". Group ID неизвестен,
  // но getTaskUrl резолвит задачу по любому userId — свой userId всегда под рукой
  function extractTaskUrl(text) {
    const taskId = text.match(NOTIF_TASK_ID_RE)?.[1];
    if (!taskId || !options.userId) return null;

    const path = getTaskUrl(null, taskId, options.userId);
    return path ? new URL(path, window.location.origin).href : null;
  }

  async function notifyNewNotifications() {
    const notifications = document.querySelectorAll('.ui-notification-manager-browser-balloon:not(.js-pts-browser-processed)');
    for (const notification of notifications) {
      notification.classList.add('js-pts-browser-processed');
    }

    for (const notification of notifications) {
      const textElement = notification.querySelector('.ui-notification-manager-browser-text');
      // Ждём, пока Bitrix закончит асинхронно дорисовывать текст (см. waitForStableText) — иначе
      // длинные уведомления (например, с большим списком соисполнителей) читаются недорисованными,
      // и isUserMentioned не находит имя, которое физически ещё не успело попасть в DOM
      const rawText = await waitForStableText(textElement);
      // Канонизируем tagall-фразу в токен TAGALL, чтобы имя из неё не считалось личным упоминанием
      const text = rawText.replace(TAGALL_NAMED_RE, TAGALL_TOKEN);
      if (!text) continue;

      if (showOwnOnly && !isUserMentioned(text, options.userFirstName, options.userLastName)) continue;

      const titleElement = notification.querySelector('.ui-notification-manager-browser-title');
      const title = titleElement?.textContent.trim() || 'Bitrix24';

      // Если задачу не удалось определить, кликом по браузерному уведомлению возвращаемся на текущую страницу
      const url = extractTaskUrl(text) ?? window.location.href;

      // Один и тот же баллон Bitrix одновременно приходит во все открытые вкладки — по этому ключу
      // фоновый скрипт схлопывает повторы в одно системное уведомление вместо N дублей
      const dedupeKey = `${title}::${text}`;

      chrome.runtime.sendMessage({
        type: 'pts-browser-notification',
        title,
        message: text,
        url,
        dedupeKey,
      });
    }
  }

  rehydrateOnChanges(
    notifyNewNotifications,
    document.body,
    {
      filterMutation: (mutation) => mutation.type === 'childList'
        && mutation.target === document.body
        && Array.from(mutation.addedNodes).some((element) => element.classList?.contains('ui-notification-manager-browser-balloon')),
    },
  );
}
