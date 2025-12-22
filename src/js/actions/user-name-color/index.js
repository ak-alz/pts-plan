import { insertCSS, validateHexColor } from '../../utils.js';

export function userNameColor(userId, color, borderColor, backgroundColor) {
  if (!userId) return;
  if (!validateHexColor(color) && !validateHexColor(borderColor) && !validateHexColor(backgroundColor)) return;

  let css = '';

  if (color) {
    css += `.feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner a[href$="/company/personal/user/${userId}/"] {
      color: ${color};
      font-weight: 700;
    }`;
  }

  if (borderColor) {
    css += `.feed-com-block:not(.mpl-comment-aux) .feed-com-main-content:has(.feed-com-text-inner-inner a[href$="/company/personal/user/${userId}/"]),
    .feed-com-block:not(.mpl-comment-aux) .feed-com-main-content:not(:has(.feed-com-user-box a.feed-author-name[href$="/company/personal/user/${userId}/"])):has(.tag-all-highlight:not(.forum-quote .tag-all-highlight)) {
      border: 1px solid ${borderColor};
    }`;
  }

  if (backgroundColor) {
    css += `.feed-com-block:not(.mpl-comment-aux) .feed-com-main-content:has(.feed-com-text-inner-inner a[href$="/company/personal/user/${userId}/"]),
    .feed-com-block:not(.mpl-comment-aux) .feed-com-main-content:not(:has(.feed-com-user-box a.feed-author-name[href$="/company/personal/user/${userId}/"])):has(.tag-all-highlight:not(.forum-quote .tag-all-highlight)) {
      background-color: ${backgroundColor};
    }`;
  }

  insertCSS(css);
}
