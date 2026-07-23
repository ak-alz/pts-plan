import {marked} from 'marked';

// Схемы, безопасные для ссылки внутри ответа AI: внешний адрес, почта и относительный путь Bitrix.
// Всё остальное (в первую очередь javascript:) — исполняемый код по клику пользователя
const SAFE_LINK_RE = /^(?:https?:|mailto:|\/)/i;

/**
 * Превращает markdown-ответ AI в HTML для вставки через `v-html`, не давая ему принести на страницу
 * собственную разметку. `marked` по умолчанию пропускает сырой HTML из исходника, а в промпт уходят
 * пользовательские данные (имена участников, названия задач) — поэтому «<» экранируется до разбора:
 * markdown-разметка при этом работает как обычно, а любой тег из текста остаётся просто текстом.
 * Единственное, что остаётся после этого сгенерировать сам `marked`, — ссылки, поэтому у них
 * дополнительно проверяется схема (см. SAFE_LINK_RE).
 * @param {string} text - Ответ AI в markdown.
 * @returns {string} HTML, пригодный для `v-html`.
 */
export function renderAiMarkdown(text) {
  if (!text) return '';

  const html = marked(String(text).replace(/</g, '&lt;'));

  // DOMParser только разбирает разметку, ничего не исполняя: скрипты не запускаются,
  // ресурсы (в т.ч. src у картинок) не загружаются
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('a[href]').forEach((link) => {
    if (!SAFE_LINK_RE.test(link.getAttribute('href').trim())) link.removeAttribute('href');
  });

  return parsed.body.innerHTML;
}
