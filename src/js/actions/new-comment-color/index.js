import { getBitrixDarkBackground, insertCSS, validateHexColor } from '../../utils.js';

export function newCommentColor(backgroundColor) {
  if (!validateHexColor(backgroundColor)) return;

  const css = `.feed-com-block-new {
    background-color: ${backgroundColor} !important;
  }
  .pts-bitrix-dark .feed-com-block-new {
    background-color: ${getBitrixDarkBackground(backgroundColor)} !important;
  }`;

  insertCSS(css);
}
