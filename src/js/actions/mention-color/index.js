import { insertCSS, validateHexColor } from '../../utils.js';

export function mentionColor(userId, borderColor) {
  if (!userId) return;
  if (!validateHexColor(borderColor)) return;

  const css = `.feed-com-main-content:has(.feed-com-text-inner-inner a[href$="/company/personal/user/${userId}/"]) {
    border: 1px solid ${borderColor} !important;
  }`;

  insertCSS(css);
}
