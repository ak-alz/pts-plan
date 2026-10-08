// dr.css + ручные правки → public/assets/bitrix-dark-theme.js. CSS вшит строкой, чтобы вставить его
// синхронно на document_start (без вспышки).
import fs from 'fs';
let css = fs.readFileSync('dr.css', 'utf8')
  .replace(/^\s*&.*$/gm, '')     // баг Dark Reader: незакрытое вложенное правило «&: :before {» роняет весь файл
  .replace(/--darkreader-/g, '--pd-')    // свои имена переменных: не путаться с живым Dark Reader, если он включён
  .replace(/\/\*[\s\S]*?\*\//g, '')   // комментарии и ASCII-арт
  .replace(/\s*\n\s*/g, '\n').replace(/\n+/g, '\n').trim();
// Dark Reader подменяет var(--X) на свою var(--pd-bg--X), а определения берёт из CSS-файлов. Если --X задаётся
// скриптом прямо в разметке (цвет стадии, колонки…), его версии нигде нет и цвет пропадает — возвращаем var(--X).
const origVars = new Set(fs.readdirSync('css').flatMap(f => [...fs.readFileSync('css/' + f, 'utf8').matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1])));   // переменные из CSS-файлов Битрикса
const defined = new Set([...css.matchAll(/(--pd-(?:bg|text|border)--[\w-]+)\s*:/g)].map(m => m[1]));
let restored = 0;
css = css.replace(/var\(--pd-(?:bg|text|border)--([\w-]+)\)/g, (m, name) => defined.has(m.slice(4, -1)) || origVars.has('--' + name) ? m : (restored++, `var(--${name})`));
console.log('возвращено переменных', restored);
css += '\n' + ['rgbvars.css', 'masks.css', 'icons.css', 'extra.css'].map(f => fs.readFileSync(f, 'utf8')).join('\n');

const runtime = fs.readFileSync('runtime.js', 'utf8').replace('__KNOWN__', JSON.stringify(JSON.parse(fs.readFileSync('paths.json', 'utf8'))));

const build = (fullCss) => `// Сгенерировано plan-dark/build/pack.mjs из CSS Dark Reader — не править руками.
(() => {
// Защита от повторного запуска в том же документе.
if (document.documentElement.hasAttribute('data-plan-dark')) return;
document.documentElement.setAttribute('data-plan-dark', '');
// По этому классу стили Pixel Plan Injection (content-styles.css) включают свои правки под тёмную тему.
document.documentElement.classList.add('pts-bitrix-dark');
const CSS = ${JSON.stringify(fullCss)};
const st = document.createElement('style');
st.id = 'plan-dark';
st.textContent = CSS;
// Как Dark Reader: наш стиль должен идти после стилей страницы, иначе при равной специфичности
// побеждает Битрикс. А Битрикс кладёт стили и в <body>, поэтому держим наш последним ребёнком <html> —
// после <body>. Следим только за прямыми детьми <html> (появление head/body), не за всем DOM.
const last = () => { if (document.documentElement.lastChild !== st) document.documentElement.append(st); };
last();
new MutationObserver(last).observe(document.documentElement, { childList: true });
${runtime}
})();
`;

fs.writeFileSync('../../public/assets/bitrix-dark-theme.js', build(css));
console.log('css', css.length);
