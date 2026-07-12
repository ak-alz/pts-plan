import {NOTIF_TASK_ID_RE, TAGALL_NAMED_RE, TAGALL_TOKEN} from '../../patterns.js';
import {getTaskUrl, isUserMentioned, rehydrateOnChanges} from '../../utils.js';

export function osNotifications(options = {}) {
  // Без имени/фамилии isUserMentioned всегда вернёт false — фильтр в этом случае отключаем,
  // а не молча блокируем все уведомления
  const showOwnOnly = !!(options.osNotificationsOwnOnly && options.userFirstName && options.userLastName);

  // Тост не содержит ссылки на задачу, только её ID в тексте вида "[#481203]". Group ID неизвестен,
  // но getTaskUrl резолвит задачу по любому userId — свой userId всегда под рукой
  function extractTaskUrl(text) {
    const taskId = text.match(NOTIF_TASK_ID_RE)?.[1];
    if (!taskId || !options.userId) return null;

    const path = getTaskUrl(null, taskId, options.userId);
    return path ? new URL(path, window.location.origin).href : null;
  }

  async function notifyNewNotifications() {
    const notifications = document.querySelectorAll('.ui-notification-manager-browser-balloon:not(.js-pts-os-processed)');
    for (const notification of notifications) {
      notification.classList.add('js-pts-os-processed');
    }

    // Ждём макротаск — Bitrix рендерит текст асинхронно после добавления элемента в DOM
    await new Promise((resolve) => setTimeout(resolve, 0));

    for (const notification of notifications) {
      const textElement = notification.querySelector('.ui-notification-manager-browser-text');
      // Канонизируем tagall-фразу в токен TAGALL, чтобы имя из неё не считалось личным упоминанием
      const text = textElement?.textContent.trim().replace(TAGALL_NAMED_RE, TAGALL_TOKEN);
      if (!text) continue;

      if (showOwnOnly && !isUserMentioned(text, options.userFirstName, options.userLastName)) continue;

      const titleElement = notification.querySelector('.ui-notification-manager-browser-title');
      const title = titleElement?.textContent.trim() || 'Bitrix24';

      // Если задачу не удалось определить, кликом по OS-уведомлению возвращаемся на текущую страницу
      const url = extractTaskUrl(text) ?? window.location.href;

      chrome.runtime.sendMessage({
        type: 'pts-os-notification',
        title,
        message: text,
        url,
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
