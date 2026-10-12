import { getBitrixDarkBackground, insertCSS, prefixBitrixDarkSelector, validateHexColor } from '../../utils.js';

export function userNameColor({userId, userNameColorColor: color, userNameColorBorder: borderColor, userNameColorBackground: backgroundColor} = {}) {
  if (!userId) return;

  // Комментарий с упоминанием пользователя или с TAGALL (кроме своих комментариев и TAGALL внутри цитаты)
  const highlightedCommentSelector = `.feed-com-block:not(.mpl-comment-aux) .feed-com-main-content:has(.feed-com-text-inner-inner a[href$="/company/personal/user/${userId}/"]),
    .feed-com-block:not(.mpl-comment-aux) .feed-com-main-content:not(:has(.feed-com-user-box a.feed-author-name[href$="/company/personal/user/${userId}/"])):has(.tag-all-highlight:not(.forum-quote .tag-all-highlight))`;

  let css = '';

  // Каждый цвет проверяется отдельно: значения идут в CSS-правило как есть, и одного валидного
  // соседа недостаточно, чтобы доверять остальным
  if (validateHexColor(color)) {
    css += `.feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner a[href$="/company/personal/user/${userId}/"] {
      color: ${color};
      font-weight: 700;
    }`;
  }

  if (validateHexColor(borderColor)) {
    css += `${highlightedCommentSelector} {
      border: 1px solid ${borderColor};
    }`;
  }

  if (validateHexColor(backgroundColor)) {
    css += `${highlightedCommentSelector} {
      background-color: ${backgroundColor};
    }
    ${prefixBitrixDarkSelector(highlightedCommentSelector)} {
      background-color: ${getBitrixDarkBackground(backgroundColor)};
    }`;
  }

  if (css) insertCSS(css);
}
