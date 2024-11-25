export default function changeUserNameColor(userId, color) {
  return `div.feed-com-text a[href="/company/personal/user/${userId}/"] {
            color: ${color} !important;
            font-weight: bold !important;
          }`;
}
