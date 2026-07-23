import {TAGALL_NAMED_RE} from '../../patterns.js';
import {isUserMentioned, rehydrateOnChanges, waitForStableText} from '../../utils.js';

const TAGALL_TOKEN = 'TAGALL';

function nameVariants(firstName, lastName) {
  return [...new Set([`${firstName} ${lastName}`, `${lastName} ${firstName}`])];
}

function applyTextTransform(textElement, firstName, lastName) {
  let html = textElement.innerHTML.replace(TAGALL_NAMED_RE, `<b>${TAGALL_TOKEN}</b>`);
  nameVariants(firstName, lastName).forEach((name) => {
    html = html.split(name).join(`<b>${name}</b>`);
  });
  textElement.innerHTML = html;
}

export function closeNotifications(firstName, lastName, options = {}) {
  if (!firstName || !lastName) return;

  const transformText = !!options.closeNotificationsTransformText;

  async function closeVisibleNotifications() {
    const notifications = document.querySelectorAll('.ui-notification-manager-browser-balloon:not(.js-notification-processed)');
    for (const notification of notifications) {
      notification.classList.add('js-notification-processed');
    }

    for (const notification of notifications) {
      const textElement = notification.querySelector('.ui-notification-manager-browser-text');
      if (!textElement) continue;

      // Ждём, пока Bitrix закончит асинхронно дорисовывать текст (см. waitForStableText) — иначе
      // длинные уведомления (например, с большим списком соисполнителей) читаются недорисованными,
      // и isUserMentioned не находит имя, которое физически ещё не успело попасть в DOM
      const rawText = await waitForStableText(textElement);
      if (!rawText) continue;

      // Канонизируем tagall-фразу в токен TAGALL, чтобы имя из неё не считалось личным упоминанием
      const canonicalText = rawText.replace(TAGALL_NAMED_RE, TAGALL_TOKEN);
      if (isUserMentioned(canonicalText, firstName, lastName)) {
        if (transformText) applyTextTransform(textElement, firstName, lastName);
        continue;
      }

      notification.querySelector('.ui-notification-manager-browser-button-close')?.click();
    }
  }

  rehydrateOnChanges(
    closeVisibleNotifications,
    document.body,
    {
      filterMutation: (mutation) => mutation.type === 'childList'
        && mutation.target === document.body
        && Array.from(mutation.addedNodes).some((element) => element.classList?.contains('ui-notification-manager-browser-balloon')),
    },
  );
}
