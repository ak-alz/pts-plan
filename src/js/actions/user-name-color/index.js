import { insertCSS, validateHexColor } from '../../utils.js';

export function userNameColor(userId, color) {
  if (!userId) return;
  if (!validateHexColor(color)) return;

  const css = `.feed-com-text-inner-inner a[href$="/company/personal/user/${userId}/"] {
    color: ${color} !important;
    font-weight: 700 !important;
  }`;

  insertCSS(css);
}
