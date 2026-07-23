import {TAGALL_NAMED_RE, TAGALL_TOKEN} from './patterns.js';
import {rehydrateOnChanges, waitForStableText} from './utils.js';

const BALLOON_CLASS = 'ui-notification-manager-browser-balloon';
const BALLOON_TEXT_SELECTOR = '.ui-notification-manager-browser-text';

/**
 * Подписывается на всплывающие уведомления Bitrix («баллоны» в правом углу страницы) и вызывает
 * `handler` для каждого нового. Текст читается через `waitForStableText` — Bitrix дорисовывает его
 * асинхронно и в несколько заходов, поэтому проверки «непустой» недостаточно; tagall-фраза при этом
 * канонизируется в токен `TAGALL`, чтобы имя из неё не считалось личным упоминанием.
 * @param {string} processedClass - CSS-класс-метка уже обработанных баллонов. У каждой фичи своя:
 * один и тот же баллон обрабатывают несколько фич, и общая метка означала бы, что первая
 * сработавшая отменяет остальные.
 * @param {function({notification: Element, textElement: Element|null, text: string}): (void|Promise<void>)} handler
 * - Вызывается для каждого нового баллона с готовым каноническим текстом. Баллоны обрабатываются
 * последовательно, чтобы ожидание текста одного не смешивалось с другим.
 * @returns {function(): void} Отписка (см. `rehydrateOnChanges`).
 */
export function onNewNotificationBalloon(processedClass, handler) {
  async function processNewBalloons() {
    const balloons = document.querySelectorAll(`.${BALLOON_CLASS}:not(.${processedClass})`);
    // Метку ставим сразу всем, до первого await: иначе следующий вызов (мутации идут пачками)
    // подхватил бы те же баллоны заново
    for (const notification of balloons) {
      notification.classList.add(processedClass);
    }

    for (const notification of balloons) {
      const textElement = notification.querySelector(BALLOON_TEXT_SELECTOR);
      const rawText = await waitForStableText(textElement);
      if (!rawText) continue;

      await handler({notification, textElement, text: rawText.replace(TAGALL_NAMED_RE, TAGALL_TOKEN)});
    }
  }

  return rehydrateOnChanges(
    processNewBalloons,
    document.body,
    {
      filterMutation: (mutation) => mutation.type === 'childList'
        && mutation.target === document.body
        && Array.from(mutation.addedNodes).some((element) => element.classList?.contains(BALLOON_CLASS)),
    },
  );
}
