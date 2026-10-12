// Шаг 4: иконки-маски (mask-image: url(svg) + background-color = цвет иконки). Живой Dark Reader красит их
// как текст, а в экспорте — как фон, и белые иконки становятся тёмными. Инвертируем такие элементы: тёмный
// «фон» после инверсии снова светлый, а цветные сохраняют оттенок благодаря hue-rotate (build/masks.css).
import {iterateCssRules, PATHS, readLocalCssFiles, stripCssComments, writeFile} from '../lib/shared.mjs';

// Объявление mask или mask-image с картинкой или переменной
const MASK_DECLARATION_PATTERN = /(?:^|;)\s*(?:-webkit-)?mask(?:-image)?\s*:[^;]*(?:url|var)\(/;
// Исключения, подобранные вручную: элементы, которые после инверсии выглядят неправильно
const EXCLUDED_SELECTOR_PATTERN = /loader|skeleton|menu-item-link|draggable/i;

const selectors = new Set();
for (const css of readLocalCssFiles()) {
  for (const rule of iterateCssRules(stripCssComments(css))) {
    if (!MASK_DECLARATION_PATTERN.test(rule.declarations)) continue;
    for (const selector of rule.selector.split(',').map((part) => part.trim())) {
      if (selector && !EXCLUDED_SELECTOR_PATTERN.test(selector)) selectors.add(selector);
    }
  }
}

const selectorList = [...selectors];
writeFile(PATHS.masksCss, selectorList.length ? `${selectorList.join(',\n')}{filter:invert(1) hue-rotate(180deg)}` : '');
console.log('селекторов с масками', selectorList.length, selectorList.slice(0, 8));
