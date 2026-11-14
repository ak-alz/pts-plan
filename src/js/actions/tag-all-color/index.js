import {initTagallMarks, TAGALL_MARK_CLASS} from '../../tagallMarks.js';
import {getTaskIdFromUrl, insertCSS, validateHexColor} from '../../utils.js';

export function tagAllColor(color) {
  if (!validateHexColor(color)) return;

  const ids = getTaskIdFromUrl(window.location.pathname);
  if (!ids?.taskId) return;

  // Заранее вставляем стили на сайт, даже если TAGALL еще не было - на будущее
  insertCSS(`.${TAGALL_MARK_CLASS} {
    color: ${color};
    font-weight: 700;
  }`);

  initTagallMarks();
}
