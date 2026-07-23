import {waitForElement} from '../../utils.js';

const ADD_BUTTON_SELECTOR = '.add[data-field="auditor"]';
const TARGET_BUTTON_SELECTOR = '[data-target="auditor"]';

(async () => {
  if (!/\/tasks\/task\/edit\/0(?:\/|\?|$)/.test(window.location.href)) return;

  // Ждём появления любой из двух кнопок: Bitrix дорисовывает поля формы асинхронно. Если их нет
  // вовсе (другая раскладка формы, нет прав), waitForElement сдастся сам — прежний цикл на
  // setTimeout в этом случае опрашивал DOM всё время жизни страницы
  const anyButton = await waitForElement(`${ADD_BUTTON_SELECTOR}, ${TARGET_BUTTON_SELECTOR}`);
  if (!anyButton) return;

  const addButton = document.querySelector(ADD_BUTTON_SELECTOR);
  const targetButton = document.querySelector(TARGET_BUTTON_SELECTOR);

  if (addButton) {
    const preventNavigation = (event) => event.preventDefault();
    addButton.addEventListener('click', preventNavigation, true);
    addButton.click();
    addButton.removeEventListener('click', preventNavigation, true);
  }

  targetButton?.click();
  // Промис этой функции никому не возвращается (модуль исполняется целиком до её завершения),
  // поэтому ошибку гасим здесь — иначе она всплыла бы необработанным отказом промиса
})().catch((error) => console.warn('[pts-plan] autoAuditor', error));
