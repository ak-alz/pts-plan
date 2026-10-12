// Шаг 6: build/darkReader.css + результаты шагов 3–5 + ручные правки (config/extra.css) → public/assets/bitrix-dark-theme.js.
// CSS вшит в скрипт строкой, чтобы вставить его синхронно на document_start, без вспышки белого.
import fs from 'fs';

import {minifyThemeCss} from '../lib/minify.mjs';
import {PATHS, readLocalCssFiles, readStylesheetPaths, stripCssComments, writeFile} from '../lib/shared.mjs';

// Дописываются после CSS Dark Reader в этом порядке; extra.css последним, чтобы ручные правки побеждали
const ADDITIONAL_CSS_FILES = [PATHS.rgbVariablesCss, PATHS.masksCss, PATHS.iconsCss, PATHS.extraCss];
// Место в runtime.js, куда подставляется список таблиц стилей из снимка
const KNOWN_STYLESHEET_PATHS_PLACEHOLDER = '/* @known-stylesheet-paths */ []';

let css = fs.readFileSync(PATHS.darkReaderCss, 'utf8')
  // Баг Dark Reader: незакрытое вложенное правило «&: :before {» роняет весь файл
  .replace(/^\s*&.*$/gm, '')
  // Свои имена переменных, чтобы не пересекаться с живым Dark Reader, если он тоже включён
  .replace(/--darkreader-/g, '--pd-');
// Комментарии (в том числе ASCII-арт Dark Reader) убираем до поиска переменных — в них тоже встречается «--…:»
css = stripCssComments(css);

// Dark Reader подменяет var(--X) на свою var(--pd-bg--X) (или text/border), а определения берёт из CSS-файлов.
// Если --X задаётся скриптом прямо в разметке (цвет стадии, колонки…), его версии нигде нет и цвет пропадает —
// такие ссылки возвращаем к исходной var(--X).
const portalVariables = new Set(readLocalCssFiles().flatMap((source) => [...source.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1])));
const definedThemeVariables = new Set([...css.matchAll(/(--pd-(?:bg|text|border)--[\w-]+)\s*:/g)].map((match) => match[1]));
let restoredCount = 0;
css = css.replace(/var\((--pd-(?:bg|text|border)--([\w-]+))\)/g, (reference, themeVariable, originalName) => {
  if (definedThemeVariables.has(themeVariable) || portalVariables.has(`--${originalName}`)) return reference;
  restoredCount++;
  return `var(--${originalName})`;
});
console.log('возвращено переменных', restoredCount);

css += '\n' + ADDITIONAL_CSS_FILES.map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n');
// Минифицируем: без комментариев, пробельные символы — в один пробел (как insertCSS из src/js/utils.js), затем
// безопасное сжатие из minify.mjs. Исходники (extra.css) остаются читаемыми, а скрипт темы и так весит мегабайты.
css = minifyThemeCss(stripCssComments(css).replace(/\s+/g, ' ').trim());

const runtimeSource = fs.readFileSync(PATHS.runtime, 'utf8');
if (!runtimeSource.includes(KNOWN_STYLESHEET_PATHS_PLACEHOLDER)) {
  throw new Error(`В runtime.js нет метки ${KNOWN_STYLESHEET_PATHS_PLACEHOLDER}`);
}
// Функция вместо строки замены — чтобы «$» в путях не превратился в спецпоследовательность replace
const runtimeCode = runtimeSource.replace(KNOWN_STYLESHEET_PATHS_PLACEHOLDER, () => JSON.stringify(readStylesheetPaths()));

/**
 * Собирает итоговый скрипт темы. Всё внутри шаблона выполняется на странице портала.
 * @param {string} themeCss Полный CSS темы.
 * @param {string} runtime Код из runtime.js с подставленным списком таблиц стилей.
 * @returns {string} Код скрипта.
 */
function buildThemeScript(themeCss, runtime) {
  return `// Сгенерировано tools/bitrix-dark-theme/pack.mjs из CSS Dark Reader — не править руками.
(() => {
// Защита от повторного запуска в том же документе
if (document.documentElement.hasAttribute('data-pts-bitrix-dark-theme')) return;
document.documentElement.setAttribute('data-pts-bitrix-dark-theme', '');
// По этому классу content-styles.css расширения включает правки своих элементов под тёмную тему
document.documentElement.classList.add('pts-bitrix-dark');
const themeStyleElement = document.createElement('style');
themeStyleElement.id = 'pts-bitrix-dark-theme';
themeStyleElement.textContent = ${JSON.stringify(themeCss)};
// Как у Dark Reader: стиль темы должен идти после стилей страницы, иначе при равной специфичности побеждает
// Битрикс. А Битрикс кладёт стили и в <body>, поэтому держим наш стиль последним ребёнком <html> — после <body>.
// Следим только за прямыми детьми <html> (появление head/body), а не за всем DOM.
const keepThemeStyleLast = () => {
  if (document.documentElement.lastChild !== themeStyleElement) document.documentElement.append(themeStyleElement);
};
keepThemeStyleLast();
new MutationObserver(keepThemeStyleLast).observe(document.documentElement, {childList: true});
${runtime}
})();
`;
}

writeFile(PATHS.output, buildThemeScript(css, runtimeCode));
console.log('символов CSS', css.length);
