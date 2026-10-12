import { getBitrixDarkBackground, insertCSS, validateHexColor } from '../../utils.js';

export function quoteColor(backgroundColor, borderColor) {
  if (!validateHexColor(backgroundColor)) return;
  if (!validateHexColor(borderColor)) return;

  const css = `.forum-quote {
    background-color: ${backgroundColor} !important;
    border-color: ${borderColor} !important;
  }
  .pts-bitrix-dark .forum-quote {
    background-color: ${getBitrixDarkBackground(backgroundColor)} !important;
  }`;

  insertCSS(css);
}
