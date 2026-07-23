import {getGroupIdFromUrl, insertCSS, rehydrateOnChanges, validateHexColor} from '../../utils.js';

// Своя метка обработанных карточек, а не общая: на тех же карточках канбана работают ещё две фичи
const PROCESSED_CLASS = 'js-kanban-user-cards-processed';

export function kanbanUserCards(backgroundColor, firstName, lastName) {
  if (!validateHexColor(backgroundColor)) return;
  if (!firstName || !lastName) return;

  const groupId = getGroupIdFromUrl(window.location.href);
  if (!groupId) return;

  const kanbanGrid = document.querySelector('.main-kanban-grid');
  if (!kanbanGrid) return;

  const className = 'kanban-user-highlight';

  const css = `.${className} {
    background-color: ${backgroundColor} !important;
  }`;

  insertCSS(css);

  function highlightCards() {
    const kanbanCards = kanbanGrid.querySelectorAll(`.main-kanban-item[data-id] .tasks-kanban-item:not(.${PROCESSED_CLASS})`);

    kanbanCards.forEach((card) => {
      card.classList.add(PROCESSED_CLASS);

      const responsibleName = card.querySelector('.tasks-kanban-item-responsible .tasks-kanban-item-author-avatar')?.getAttribute('title') || '';

      if (responsibleName.includes(`${firstName} ${lastName}`) || responsibleName.includes(`${lastName} ${firstName}`)) {
        card.classList.add(className);
      }
    });
  }

  highlightCards();

  rehydrateOnChanges(highlightCards, kanbanGrid);
}
