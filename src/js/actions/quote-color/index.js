import { insertCSS, validateHexColor } from '../../utils.js';

export function quoteColor(backgroundColor, borderColor) {
  if (!validateHexColor(backgroundColor)) return;
  if (!validateHexColor(borderColor)) return;

  const css = `.forum-quote {
    background-color: ${backgroundColor} !important;
    border-color: ${borderColor} !important;
  }`;

  insertCSS(css);
}
