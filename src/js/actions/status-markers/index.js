import {getTaskAndGroupIdsFromUrl, insertCSS} from '../../utils.js';

(() => {
  const ids = getTaskAndGroupIdsFromUrl(window.location.href);
  if (!ids?.taskId) return;

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
})();
