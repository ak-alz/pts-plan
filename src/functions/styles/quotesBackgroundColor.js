export default function quotesBackgroundColor(color, borderColor) {
  return `table.forum-quote {
            background-color: ${color} !important;
            border-color: ${borderColor} !important;
            color: black !important;
          }
          table.forum-quote a {
            color: #2067b0 !important;
          }`;
}
