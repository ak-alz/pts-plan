// Иконки-маски (mask-image: url(svg) + background-color = цвет иконки). Dark Reader в живом режиме красит
// их как текст, а в экспорте — как фон: белые иконки становятся тёмными. Инвертируем такие элементы:
// тёмный «фон» после инверсии снова светлый, цветные остаются своего оттенка (hue-rotate).
import fs from 'fs';
const sel = new Set();
for (const f of fs.readdirSync('css')) {
  const src = fs.readFileSync('css/' + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of src.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    if (!/(?:^|;)\s*(?:-webkit-)?mask(?:-image)?\s*:[^;]*(?:url|var)\(/.test(m[2])) continue;
    for (const s of m[1].split(',').map(s => s.trim()))
      if (s && !/loader|skeleton|menu-item-link|draggable/i.test(s)) sel.add(s);
  }
}
const list = [...sel];
fs.writeFileSync('masks.css', list.length ? list.join(',\n') + '{filter:invert(1) hue-rotate(180deg)}' : '');
console.log(list.length, list.slice(0, 8));
