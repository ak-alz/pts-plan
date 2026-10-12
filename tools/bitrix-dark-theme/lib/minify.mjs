// Сжатие CSS темы перед упаковкой: сначала свои преобразования, которых нет в минификаторах (зацепки Dark Reader),
// затем Lightning CSS — пробелы, сокращение цветов и свойств, склейка соседних правил. Он учитывает порядок
// и специфичность, так что результат на странице не меняется.
import {transform} from 'lightningcss';

// Ссылка вида var(--pd-text-000000, #cdd9e5): в живом Dark Reader это зацепка для пересчёта на лету, в снимке
// переменная не определена, и браузер всегда берёт запасное значение
const DARK_READER_HOOK_PATTERN = /var\((--pd-(?:background|text|border)-[0-9a-f]{3,8}),\s*([^()]+?|rgba?\([^)]*\))\)/g;
const BORDER_SIDES = ['top', 'right', 'bottom', 'left'];
// Минимальная версия Chrome, под которую минифицировать: Lightning CSS не уберёт префиксы, нужные ей
const MIN_CHROME_VERSION = 100;

/**
 * Заменяет ссылки на неопределённые переменные-зацепки Dark Reader их запасным значением.
 * @param {string} css CSS темы.
 * @returns {string} CSS без лишних обёрток `var()`.
 */
function unwrapDarkReaderHooks(css) {
  const definedVariables = new Set([...css.matchAll(/(--pd-[\w-]+)\s*:/g)].map((match) => match[1]));
  return css.replace(DARK_READER_HOOK_PATTERN, (reference, name, fallback) => (definedVariables.has(name) ? reference : fallback.trim()));
}

/**
 * Склеивает четыре одинаковых `border-*-color` блока объявлений в один `border-color` на месте первого из них.
 * @param {string} declarations Объявления одного правила (без фигурных скобок), уже без лишних пробелов.
 * @returns {string} Объявления с `border-color` вместо четырёх сторон, если это возможно.
 */
function mergeBorderColors(declarations) {
  // Другое свойство рамки (border, border-color, border-top…) между сторонами — переносить их на место первой нельзя
  if (/(?:^|;)border(?:-(?:top|right|bottom|left))?(?:-color)?:/.test(declarations.replace(/(?:^|;)border-(?:top|right|bottom|left)-color:/g, ';'))) return declarations;
  const values = BORDER_SIDES.map((side) => declarations.match(new RegExp(`(?:^|;)border-${side}-color:([^;]+)`))?.[1]);
  if (!values.every((value) => value !== undefined && value === values[0])) return declarations;
  let isFirst = true;
  return declarations.replace(/(^|;)border-(?:top|right|bottom|left)-color:[^;]+/g, (match, separator) => {
    if (!isFirst) return '';
    isFirst = false;
    return `${separator}border-color:${values[0]}`;
  }).replace(/^;/, '');
}

/**
 * Убирает лишние пробелы внутри блоков объявлений и склеивает рамки. Содержимое `url(…)` и строки в кавычках
 * не трогаются — в data-URL картинок пробелы значимы. Селекторы тоже не трогаются: пробел перед `:hover`
 * в селекторе — это комбинатор потомка.
 * @param {string} css CSS темы.
 * @returns {string} Сжатый CSS.
 */
function compactDeclarations(css) {
  // Заглушка — символ из области частного использования Unicode: в CSS темы его нет
  const protectedParts = [];
  const protect = (match) => `\uE000${protectedParts.push(match) - 1}\uE000`;
  // Сначала строки в кавычках, потом url() без кавычек: скобка внутри SVG в кавычках не должна обрывать защиту
  const withPlaceholders = css.replace(/"[^"]*"|'[^']*'|url\([^)"']*\)/g, protect);
  const compacted = withPlaceholders.replace(/\{([^{}]*)\}/g, (block, declarations) => {
    const compactedDeclarations = declarations
      .replace(/\s*;\s*/g, ';')
      .replace(/\s*:\s*/g, ':')
      .replace(/\s*,\s*/g, ',')
      .replace(/\s*!important/g, '!important')
      .trim()
      .replace(/;$/, '');
    return `{${mergeBorderColors(compactedDeclarations)}}`;
  });
  return compacted
    .replace(/\s*([{}])\s*/g, '$1')
    .replace(/\uE000(\d+)\uE000/g, (placeholder, index) => protectedParts[Number(index)]);
}

/**
 * Минифицирует CSS через Lightning CSS. Правила, которые он не смог разобрать, он выбрасывает с предупреждением —
 * их выводим в консоль, чтобы потеря не прошла незаметно.
 * @param {string} css CSS темы.
 * @returns {string} Минифицированный CSS.
 */
function minifyWithLightningCss(css) {
  const {code, warnings} = transform({
    filename: 'bitrix-dark-theme.css',
    code: Buffer.from(css),
    minify: true,
    errorRecovery: true,
    // Версия упакована в одно число: major << 16
    targets: {chrome: MIN_CHROME_VERSION << 16},
  });
  if (warnings.length) {
    console.warn('Lightning CSS: предупреждений', warnings.length);
    warnings.slice(0, 10).forEach((warning) => console.warn('  ', warning.message, warning.loc ? `(строка ${warning.loc.line})` : ''));
  }
  return code.toString();
}

/**
 * Сжимает CSS темы без изменения результата на странице.
 * @param {string} css CSS темы.
 * @returns {string} Сжатый CSS.
 */
export function minifyThemeCss(css) {
  return minifyWithLightningCss(compactDeclarations(unwrapDarkReaderHooks(css)));
}
