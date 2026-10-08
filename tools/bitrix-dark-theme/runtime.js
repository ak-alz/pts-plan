/* global __KNOWN__, st */
// Фрагмент скрипта темы: pack.mjs подставляет __KNOWN__ и вставляет его в обёртку, где объявлен st.
// Страховка для стилей, которых нет в снимке (самописные компоненты портала, новые модули Битрикса):
// один раз на каждую новую таблицу стилей пересчитываем её цвета под тёмную тему.
// Не Dark Reader: не следим за всем DOM и inline-стилями — только за появлением <link>/<style>.
const KNOWN = new Set(__KNOWN__);
const dyn = document.createElement('style');
dyn.id = 'plan-dark-dyn';
const done = new WeakSet();
const parse = c => {
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { let h = m[1]; if (h.length <= 4) h = [...h].map(x => x + x).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1); }
  m = c.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]];
  return { white: [255, 255, 255, 1], black: [0, 0, 0, 1] }[c.toLowerCase()] || null;
};
const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  return [(mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6, s, l]; };
// Серые (без оттенка) красим в синеватый тон палитры (#22272e), иначе выбиваются из снимка.
const out = (h, s, l, a) => { if (s < .06) { h = .59; s = .14; } return `hsla(${Math.round(h * 360)},${Math.round(s * 100)}%,${Math.round(l * 100)}%,${a})`; };
// Палитра та же, что в снимке: фон ~#22272e, текст ~#adbac7.
const MAP = {
  bg: ([h, s, l], a) => l > .5 ? out(h, s * .5, .13 + (1 - l) * .3, a) : null,
  text: ([h, s, l], a) => l < .5 ? out(h, s * .6, .72 + (.5 - l) * .3, a) : null,
  border: ([h, s, l], a) => l > .5 ? out(h, s * .5, .22 + (1 - l) * .3, a) : null,
};
const COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/gi;
const conv = (v, kind) => { let changed = false;
  const r = v.replace(COLOR_RE, c => { const p = parse(c); if (!p) return c; const n = MAP[kind](hsl(p), p[3]); if (n) changed = true; return n || c; });
  return changed ? r : null; };
const KIND = { 'background-color': 'bg', 'background-image': 'bg', color: 'text', fill: 'text', stroke: 'text',
  'border-top-color': 'border', 'border-right-color': 'border', 'border-bottom-color': 'border', 'border-left-color': 'border', 'outline-color': 'border' };
function rules(list, acc) {
  for (const r of list) {
    if (r.cssRules && !r.selectorText) { const inner = []; rules(r.cssRules, inner);
      if (inner.length && r.media) acc.push(`@media ${r.media.mediaText}{${inner.join('')}}`); else acc.push(...inner); continue; }
    if (!r.selectorText || !r.style) continue;
    const decl = [];
    for (const p in KIND) { const v = r.style.getPropertyValue(p); if (!v || v.includes('var(') || (p === 'background-image' && /url\(/.test(v))) continue;
      const n = conv(v, KIND[p]); if (n) decl.push(`${p}:${n}${r.style.getPropertyPriority(p) ? '!important' : ''}`); }
    if (decl.length) acc.push(`${r.selectorText}{${decl.join(';')}}`);
  }
}
function scan() {
  let add = '';
  for (const s of document.styleSheets) {
    const n = s.ownerNode; if (!n || n === dyn || n.id === 'plan-dark' || done.has(s)) continue;
    if (s.href) { try { if (KNOWN.has(new URL(s.href).pathname)) { done.add(s); continue; } } catch { /* битый href — проверим как незнакомую */ } }
    let list; try { list = s.cssRules; } catch { done.add(s); continue; }   // чужой домен — не читается
    done.add(s); const acc = []; rules(list, acc); add += acc.join('\n');
  }
  if (add) dyn.textContent += '\n' + add;
  if (dyn.parentNode !== document.documentElement || dyn.nextSibling !== st) document.documentElement.insertBefore(dyn, st);
}
// Новые таблицы: <link> досчитываем по загрузке, <style> — сразу (батчем на кадр).
let queued = false;
const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; scan(); }); } };
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) {
  if (n.nodeName === 'LINK') n.addEventListener('load', later, { once: true });
  else if (n.nodeName === 'STYLE' && n !== st && n !== dyn) later(); } })
  .observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', later);
window.addEventListener('load', later);
