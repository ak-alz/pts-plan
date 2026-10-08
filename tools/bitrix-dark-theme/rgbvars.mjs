// Dark Reader не переписывает цвета вида rgba(var(--…-rgb), a): цвет собирается из числовой переменной.
// Находим такие объявления в исходном CSS Битрикса и выдаём тот же селектор с цветом под тёмную тему.
import fs from 'fs';
const BG = '34,39,46', TEXT = '173,186,199';   // палитра — та же, что в gen.mjs
const WHITE = /var\(--(?:ui|im)-color-(?:palette-white-base|on-primary)-rgb\)/;
const DARK = /var\(--ui-color-(?:palette-black-(?:solid|base)|base-solid|base-default|text-primary|text-secondary|palette-gray-90)-rgb\)/;
const out = [];
for (const f of fs.readdirSync('css')) {
  const src = fs.readFileSync('css/' + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of src.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const decl = [];
    for (const d of m[2].matchAll(/(?:^|;)\s*(background(?:-color)?|color|border(?:-[a-z]+)?-color)\s*:\s*rgba\(\s*(var\([^)]*\))\s*,\s*([\d.]+)\s*\)/g)) {
      const [, prop, v, a] = d, isBg = prop.startsWith('background');
      if (isBg && WHITE.test(v)) decl.push(`background-color:rgba(${BG},${a})`);                 // белая подложка → тёмная
      else if (isBg && DARK.test(v) && +a < .5) decl.push(`background-color:rgba(255,255,255,${a})`); // тёмная дымка → светлая
      else if (!isBg && DARK.test(v)) decl.push(`${prop}:rgba(${TEXT},${a})`);                     // тёмный текст/рамка → светлые
    }
    if (decl.length) out.push(`${m[1].trim()}{${decl.join(';')}}`);
  }
}
fs.writeFileSync('rgbvars.css', [...new Set(out)].join('\n'));
console.log(out.length);
