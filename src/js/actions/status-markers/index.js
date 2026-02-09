import {getTaskAndGroupIdsFromUrl, insertCSS, rehydrateOnChanges} from '../../utils.js';

(() => {
  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const statusContainer = document.querySelector('.task-section-status-container-flex');
  if (!statusContainer) return;

  const css = `.task-section-status-step::before {
    position: absolute;
    top: 50%;
    left: 50%;
    display: block;
    width: 1.1ch;
    height: 100%;
    overflow: hidden;
    font-size: 10px;
    line-height: 1;
    white-space: nowrap;
    text-transform: uppercase;
    transform: translate(-50%, -50%);
    content: attr(title);
  }`;

  insertCSS(css);

  /* Фикс бага Bitrix 24:
   если изменить статус задачи, а потом вернуться к предыдущему статусу,
   то остается inline-стиль color: rgb(255, 255, 255); */
  function fixStyles() {
    const brokenElements = statusContainer.querySelectorAll('.task-section-status-step[style*="color: rgb(255, 255, 255);"]:not([style*="background-color"])');
    brokenElements.forEach((element) => {
      element.style.color = '';
    });
  }

  rehydrateOnChanges(
    fixStyles,
    statusContainer,
    {
      attributes: ['style'],
    },
  );
})();
