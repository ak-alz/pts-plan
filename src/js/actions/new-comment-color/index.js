import { insertCSS, validateHexColor } from '../../utils.js';

export function newCommentColor(backgroundColor) {
  if (!validateHexColor(backgroundColor)) return;

  const css = `.feed-com-block-new {
    background-color: ${backgroundColor} !important;
  }`;

  insertCSS(css);
}
