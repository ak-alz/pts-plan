export default function parseHtml(text) {
  const parser = new DOMParser();
  return parser.parseFromString(text, 'text/html');
}
