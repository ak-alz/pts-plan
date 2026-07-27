import {insertCSS} from '../../utils.js';

const selectors = [
  '.main-kanban-column-items .tasks-kanban-item-title',
  '.task-detail-description',
  '.bx-im-content-notification-item-content__content-text',
  '.bx-im-list-recent-item__message_text',
  '.feed-com-text-inner-inner',
  '.ui-toolbar-title-item',
  '.pts-blur',
  '.ui-notification-manager-browser-text',
  // Ответ AI — свободный текст, в котором модель называет и людей, и задачи
  '.pts-ai-result',
];

(() => {
  const css = `${selectors.join(', ')} {
    filter: blur(6px) !important;
  }`;

  insertCSS(css, 'screen-blur');
})();
