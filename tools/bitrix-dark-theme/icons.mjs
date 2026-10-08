// Иконки фоновыми картинками (SVG): живой Dark Reader перекрашивает тёмные иконки на лету, статичный CSS —
// нет, и они теряются на тёмном фоне. Берём только SVG, где ВСЕ цвета тёмные, и выдаём перекрашенную копию
// (светлота зеркалится, оттенок сохраняется) под тем же селектором. Цветные/светлые картинки не трогаем.
import fs from 'fs';
const paths = JSON.parse(fs.readFileSync('paths.json', 'utf8'));
const NAMED = { black: '#000000', white: '#ffffff' };
const hex = c => { c = NAMED[c.toLowerCase()] || c; let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) { let h = m[1]; if (h.length === 3) h = [...h].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i); return m ? [+m[1], +m[2], +m[3]] : null; };
const toHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, s, l]; };
const fromHsl = ([h, s, l]) => { const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
  return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return '#' + [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, '0')).join(''); };
const light = rgb => { const [h, s, l] = toHsl(rgb); return fromHsl([h, s, Math.min(.88, Math.max(.62, 1 - l))]); };
const COLOR = /(fill|stroke|stop-color|color)\s*[=:]\s*["']?(#[0-9a-f]{3,6}\b|rgba?\([^)]*\)|black|white)/gi;
function recolor(svg) {
  const cols = [...svg.matchAll(COLOR)].map(m => hex(m[2])).filter(Boolean);
  const hasShapes = /<(path|circle|rect|polygon|ellipse|line|polyline)\b/i.test(svg);
  if (!hasShapes || /<image\b|url\(#|<(linear|radial)Gradient/i.test(svg)) return null;   // сложные картинки — мимо
  if (cols.length && !cols.every(c => toHsl(c)[2] < .5)) return null;                     // есть светлое/яркое — мимо
  let out = svg.replace(COLOR, (m, p, c) => { const rgb = hex(c); return rgb ? m.replace(c, light(rgb)) : m; });
  if (!/fill\s*[=:]/i.test(svg)) out = out.replace(/<svg\b/i, '<svg fill="#c9d1d9"');          // заливка по умолчанию — чёрная
  return out;
}
const decode = u => { const m = u.match(/^data:image\/svg\+xml(;[^,]*)?,(.*)$/s); if (!m) return null;
  return /base64/.test(m[1] || '') ? Buffer.from(m[2], 'base64').toString('utf8') : decodeURIComponent(m[2].replace(/%(?![0-9a-f]{2})/gi, '%25')); };
const svgCache = new Map();
async function load(url) { if (!svgCache.has(url)) svgCache.set(url, fetch(url).then(r => r.ok ? r.text() : null).catch(() => null)); return svgCache.get(url); }
const out = new Set(); let seen = 0;
for (const p of paths) {
  const f = 'css/' + p.replace(/\//g, '_'); if (!fs.existsSync(f)) continue;
  const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const base = 'https://plan.pixelplus.ru' + p;
  for (const m of src.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const d = m[2].match(/background(?:-image)?\s*:[^;]*?url\(\s*(["']?)(.*?)\1\s*\)/); if (!d) continue;
    if (/gradient/.test(m[2]) || /loader|skeleton|mask/i.test(m[1])) continue;
    const u = d[2]; let svg = null; seen++;
    if (u.startsWith('data:image/svg')) svg = decode(u);
    else if (/\.svg(\?|$)/i.test(u)) svg = await load(new URL(u, base).href);
    if (!svg) continue;
    const r = recolor(svg); if (!r) continue;
    out.add(`${m[1].trim()}{background-image:url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(r)}")}`);
  }
}
fs.writeFileSync('icons.css', [...out].join('\n'));
console.log('картинок', seen, 'перекрашено', out.size);
