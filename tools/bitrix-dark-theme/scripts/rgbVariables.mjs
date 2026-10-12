// Шаг 3: Dark Reader не переписывает цвета вида rgba(var(--…-rgb), a) — цвет собирается из числовой
// переменной, и распознать его как цвет нельзя. Находим такие объявления в исходном CSS портала и выдаём
// тот же селектор с цветом под тёмную тему (build/rgbVariables.css).
import {hexToRgbChannels, iterateCssRules, PALETTE, PATHS, readLocalCssFiles, stripCssComments, writeFile} from '../lib/shared.mjs';

const BACKGROUND_CHANNELS = hexToRgbChannels(PALETTE.background);
const TEXT_CHANNELS = hexToRgbChannels(PALETTE.text);
// Переменные со светлым цветом — белые подложки
const LIGHT_VARIABLE_PATTERN = /var\(--(?:ui|im)-color-(?:palette-white-base|on-primary)-rgb\)/;
// Переменные с тёмным цветом — текст, рамки, тёмная дымка
const DARK_VARIABLE_PATTERN = /var\(--ui-color-(?:palette-black-(?:solid|base)|base-solid|base-default|text-primary|text-secondary|palette-gray-90)-rgb\)/;
// Объявление цвета фона, текста или рамки через rgba(var(…), alpha)
const RGBA_VARIABLE_DECLARATION_PATTERN = /(?:^|;)\s*(background(?:-color)?|color|border(?:-[a-z]+)?-color)\s*:\s*rgba\(\s*(var\([^)]*\))\s*,\s*([\d.]+)\s*\)/g;
// Тёмная дымка прозрачнее этого — лёгкое затемнение, его делаем светлой дымкой; плотнее — оставляем
const MAX_HAZE_ALPHA = 0.5;

/**
 * Подбирает тёмной теме замену объявлению с rgba-переменной.
 * @param {string} property CSS-свойство.
 * @param {string} variable Выражение `var(--…)`.
 * @param {string} alpha Прозрачность из исходного объявления.
 * @returns {string|null} Новое объявление или `null`, если цвет трогать не нужно.
 */
function convertDeclaration(property, variable, alpha) {
  const isBackground = property.startsWith('background');
  if (isBackground && LIGHT_VARIABLE_PATTERN.test(variable)) {
    return `background-color:rgba(${BACKGROUND_CHANNELS},${alpha})`;
  }
  if (isBackground && DARK_VARIABLE_PATTERN.test(variable) && Number(alpha) < MAX_HAZE_ALPHA) {
    return `background-color:rgba(255,255,255,${alpha})`;
  }
  if (!isBackground && DARK_VARIABLE_PATTERN.test(variable)) {
    return `${property}:rgba(${TEXT_CHANNELS},${alpha})`;
  }
  return null;
}

const convertedRules = [];
for (const css of readLocalCssFiles()) {
  for (const rule of iterateCssRules(stripCssComments(css))) {
    const declarations = [];
    for (const [, property, variable, alpha] of rule.declarations.matchAll(RGBA_VARIABLE_DECLARATION_PATTERN)) {
      const declaration = convertDeclaration(property, variable, alpha);
      if (declaration) declarations.push(declaration);
    }
    if (declarations.length) convertedRules.push(`${rule.selector.trim()}{${declarations.join(';')}}`);
  }
}

writeFile(PATHS.rgbVariablesCss, [...new Set(convertedRules)].join('\n'));
console.log('правил с rgba-переменными', convertedRules.length);
