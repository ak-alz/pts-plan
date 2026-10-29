/* global themeStyleElement, isThemeEnabled */
// Фрагмент скрипта темы, а не самостоятельный файл: pack.mjs подставляет список известных таблиц стилей и
// вставляет этот код в обёртку, где объявлены themeStyleElement — основной <style> темы — и isThemeEnabled —
// не выключена ли тема на лету.
//
// Страховка для стилей, которых нет в снимке (самописные компоненты портала, новые модули Битрикса): один раз
// на каждую новую таблицу стилей пересчитываем её цвета под тёмную тему. Это не Dark Reader: за всем DOM и
// inline-стилями не следим — только за появлением <link>/<style>.

// Таблицы стилей из снимка — их цвета уже в основном CSS темы. pack.mjs заменяет пустой массив списком из config/paths.json.
const KNOWN_STYLESHEET_PATHS = new Set(/* @known-stylesheet-paths */ []);

const NAMED_COLORS = {white: [255, 255, 255, 1], black: [0, 0, 0, 1]};
// white/black — только отдельным словом: в именах переменных (--ui-color-palette-black-base) их трогать нельзя
const COLOR_PATTERN = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|(?<![\w-])(?:white|black)(?![\w-])/gi;
// Палитра снимка синеватая (фон ~#22272e, текст ~#cdd9e5), поэтому чисто серые цвета подкрашиваем в её тон
const GRAY_SATURATION_THRESHOLD = 0.06;
const PALETTE_HUE = 0.59;
const PALETTE_SATURATION = 0.14;

// Какой вид цвета у каждого свойства — от вида зависит, как его пересчитывать
const PROPERTY_COLOR_KINDS = {
  'background-color': 'background',
  'background-image': 'background',
  'color': 'text',
  'fill': 'text',
  'stroke': 'text',
  'border-top-color': 'border',
  'border-right-color': 'border',
  'border-bottom-color': 'border',
  'border-left-color': 'border',
  'outline-color': 'border',
};

// Сокращённые свойства: если в них есть var(), Chrome не раскладывает значение по полным свойствам (те пустые),
// поэтому переменные в них переписываем отдельно. Без var() их цвета и так видны через полные свойства выше.
const SHORTHAND_COLOR_KINDS = {
  'background': 'background',
  'border': 'border',
  'border-color': 'border',
  'border-top': 'border',
  'border-right': 'border',
  'border-bottom': 'border',
  'border-left': 'border',
  'outline': 'border',
};

// Dark Reader для каждой переменной портала --X заводит тёмные версии по виду свойства: --pd-bg--X, --pd-text--X, --pd-border--X
const DARK_VARIABLE_PREFIXES = {background: '--pd-bg-', text: '--pd-text-', border: '--pd-border-'};
// Начало ссылки на переменную: var(--X) или var(--X, запасное значение) — подменяется только имя
const VARIABLE_REFERENCE_PATTERN = /var\(\s*(--[\w-]+)/g;

// Пересчитанные правила — порциями в отдельные <style> с этим атрибутом: дописывание в один тег заставляло бы
// браузер заново разбирать весь накопленный CSS. Стоят после <body> и перед основным стилем темы, чтобы
// перебивать стили страницы, но уступать ручным правкам
const DYNAMIC_STYLE_ATTRIBUTE = 'data-pts-bitrix-dark-theme-dynamic';
const dynamicStyleElements = [];
const processedStylesheets = new WeakSet();

// Фреймы без скрипта темы: визуальный редактор Битрикса (описание задачи, комментарии) заполняет свой iframe
// через document.open(), а тот стирает всё, что тема успела туда вставить. Такие фреймы перекрашивает
// родительская страница — пересчитанные правила кладёт в один <style> с этим атрибутом
const FRAME_STYLE_ATTRIBUTE = 'data-pts-bitrix-dark-theme-frame';
const frameStyleElements = new Set();
const watchedFrames = new WeakSet();
// Живая коллекция: не нужно искать iframe в каждом добавленном узле
const frameElements = document.getElementsByTagName('iframe');

/**
 * Разбирает CSS-цвет.
 * @param {string} color `#rgb[a]`, `#rrggbb[aa]`, `rgb(…)`/`rgba(…)`, `white` или `black`.
 * @returns {number[]|null} `[red, green, blue, alpha]` (каналы 0–255, alpha 0–1) или `null`.
 */
function parseColor(color) {
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length <= 4) hex = [...hex].map((digit) => digit + digit).join('');
    const alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
    return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).concat(alpha);
  }

  const rgbMatch = color.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (rgbMatch) {
    const [, red, green, blue, alpha] = rgbMatch;
    let alphaValue = 1;
    if (alpha !== undefined) alphaValue = alpha.endsWith('%') ? parseFloat(alpha) / 100 : Number(alpha);
    return [Number(red), Number(green), Number(blue), alphaValue];
  }

  return NAMED_COLORS[color.toLowerCase()] || null;
}

/**
 * Переводит цвет из RGB в HSL.
 * @param {number[]} rgb Каналы `[red, green, blue, …]` 0–255, лишние элементы игнорируются.
 * @returns {number[]} `[hue, saturation, lightness]`, каждый 0–1.
 */
function rgbToHsl(rgb) {
  const [red, green, blue] = rgb.slice(0, 3).map((channel) => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return [hue / 6, saturation, lightness];
}

/**
 * Собирает цвет `hsla(…)`; серые цвета подкрашивает в тон палитры.
 * @param {number} hue Оттенок 0–1.
 * @param {number} saturation Насыщенность 0–1.
 * @param {number} lightness Светлота 0–1.
 * @param {number} alpha Прозрачность 0–1.
 * @returns {string} Цвет `hsla(…)`.
 */
function formatHsla(hue, saturation, lightness, alpha) {
  const isGray = saturation < GRAY_SATURATION_THRESHOLD;
  const finalHue = isGray ? PALETTE_HUE : hue;
  const finalSaturation = isGray ? PALETTE_SATURATION : saturation;
  return `hsla(${Math.round(finalHue * 360)},${Math.round(finalSaturation * 100)}%,${Math.round(lightness * 100)}%,${alpha})`;
}

// Пересчёт цвета каждого вида. null — цвет и так подходит тёмной теме, оставляем его.
const COLOR_CONVERTERS = {
  // Светлый фон → тёмный: чем светлее был, тем темнее станет
  background: ([hue, saturation, lightness], alpha) => (lightness > 0.5 ? formatHsla(hue, saturation * 0.5, 0.13 + (1 - lightness) * 0.3, alpha) : null),
  // Тёмный текст → светлый: чем темнее был, тем светлее станет
  text: ([hue, saturation, lightness], alpha) => (lightness < 0.5 ? formatHsla(hue, saturation * 0.6, 0.82 + (0.5 - lightness) * 0.2, alpha) : null),
  // Светлая рамка → тёмная, но светлее фона
  border: ([hue, saturation, lightness], alpha) => (lightness > 0.5 ? formatHsla(hue, saturation * 0.5, 0.22 + (1 - lightness) * 0.3, alpha) : null),
};

/**
 * Пересчитывает все цвета в значении CSS-свойства.
 * @param {string} value Значение свойства, может содержать несколько цветов.
 * @param {'background'|'text'|'border'} colorKind Вид цвета.
 * @returns {string|null} Новое значение или `null`, если ни один цвет не поменялся.
 */
function convertColorValue(value, colorKind) {
  let changed = false;
  const convertedValue = value.replace(COLOR_PATTERN, (color) => {
    const rgba = parseColor(color);
    if (!rgba) return color;
    const convertedColor = COLOR_CONVERTERS[colorKind](rgbToHsl(rgba), rgba[3]);
    if (convertedColor) changed = true;
    return convertedColor || color;
  });
  return changed ? convertedValue : null;
}

// Есть ли у Dark Reader тёмная версия переменной — проверяем один раз на имя
const rootStyle = getComputedStyle(document.documentElement);
const darkVariableExists = new Map();

/**
 * Подменяет переменные портала в значении их тёмными версиями из снимка Dark Reader. Так модули, которых нет
 * в снимке (подгружаются по требованию: окно пользователя, учёт времени…), получают те же цвета, что и остальные.
 * @param {string} value Значение свойства.
 * @param {'background'|'text'|'border'} colorKind Вид цвета.
 * @returns {string|null} Новое значение или `null`, если ни одной тёмной версии не нашлось.
 */
function convertVariables(value, colorKind) {
  let changed = false;
  const convertedValue = value.replace(VARIABLE_REFERENCE_PATTERN, (reference, name) => {
    // --pd-text- + -ui-color-base-1 = --pd-text--ui-color-base-1
    const darkName = DARK_VARIABLE_PREFIXES[colorKind] + name.slice(1);
    if (!darkVariableExists.has(darkName)) darkVariableExists.set(darkName, rootStyle.getPropertyValue(darkName).trim() !== '');
    if (!darkVariableExists.get(darkName)) return reference;
    changed = true;
    // Запасное значение, если оно было, остаётся после имени — тёмная переменная определена, и оно не понадобится
    return `var(${darkName}`;
  });
  return changed ? convertedValue : null;
}

/**
 * Переводит значение свойства под тёмную тему: переменные — на тёмные версии, явные цвета — пересчётом.
 * @param {string} value Значение свойства.
 * @param {'background'|'text'|'border'} colorKind Вид цвета.
 * @param {boolean} withVariables Подменять ли переменные: их тёмные версии определены только в документе с темой.
 * @returns {string|null} Новое значение или `null`, если менять нечего.
 */
function convertPropertyValue(value, colorKind, withVariables) {
  let convertedValue = value;
  let changed = false;
  if (withVariables && value.includes('var(')) {
    const withDarkVariables = convertVariables(convertedValue, colorKind);
    if (withDarkVariables) {
      convertedValue = withDarkVariables;
      changed = true;
    }
  }
  // В url() цвета не трогаем: «white» в имени файла или «#» в ссылке испортили бы адрес картинки
  if (!/url\(/.test(value)) {
    const withConvertedColors = convertColorValue(convertedValue, colorKind);
    if (withConvertedColors) {
      convertedValue = withConvertedColors;
      changed = true;
    }
  }
  return changed ? convertedValue : null;
}

/**
 * Собирает пересчитанные под тёмную тему правила из списка CSS-правил.
 * @param {CSSRuleList} ruleList Правила таблицы стилей или группирующего правила.
 * @param {string[]} accumulator Куда складывать готовые правила.
 * @param {boolean} [withVariables] Подменять ли переменные портала их тёмными версиями.
 */
function collectConvertedRules(ruleList, accumulator, withVariables = true) {
  for (const rule of ruleList) {
    // Группирующие правила (@media, @supports, @layer…) обходим вглубь; обёртку сохраняем только для @media
    if (rule.cssRules && !rule.selectorText) {
      const innerRules = [];
      collectConvertedRules(rule.cssRules, innerRules, withVariables);
      if (innerRules.length && rule.media) accumulator.push(`@media ${rule.media.mediaText}{${innerRules.join('')}}`);
      else accumulator.push(...innerRules);
      continue;
    }
    if (!rule.selectorText || !rule.style) continue;

    const declarations = [];
    const addDeclaration = (property, colorKind) => {
      const convertedValue = convertPropertyValue(rule.style.getPropertyValue(property), colorKind, withVariables);
      if (!convertedValue) return;
      const priority = rule.style.getPropertyPriority(property) ? '!important' : '';
      declarations.push(`${property}:${convertedValue}${priority}`);
    };
    for (const [property, colorKind] of Object.entries(PROPERTY_COLOR_KINDS)) {
      if (rule.style.getPropertyValue(property)) addDeclaration(property, colorKind);
    }
    for (const [property, colorKind] of Object.entries(SHORTHAND_COLOR_KINDS)) {
      if (rule.style.getPropertyValue(property).includes('var(')) addDeclaration(property, colorKind);
    }
    if (declarations.length) accumulator.push(`${rule.selectorText}{${declarations.join(';')}}`);
  }
}

/**
 * Стили самого расширения и PrimeVue перекрашивать нельзя: у виджетов своя тёмная тема (класс `.pts-dark`),
 * а пересчитанная копия правила перебила бы цвет, который выбрал пользователь (например, подсветку карточек).
 * @param {Element} ownerNode Тег `<style>` или `<link>` таблицы стилей.
 * @returns {boolean} Принадлежит ли таблица расширению.
 */
function isExtensionStylesheet(ownerNode) {
  return ownerNode.hasAttribute('data-pts')
    || ownerNode.hasAttribute('data-primevue-style-id')
    || ownerNode.href?.startsWith('chrome-extension://');
}

/**
 * Проходит по таблицам стилей документа и пересчитывает те, что ещё не видели и которых нет в снимке.
 */
function scanNewStylesheets() {
  const addedRules = [];
  for (const stylesheet of document.styleSheets) {
    const ownerNode = stylesheet.ownerNode;
    // ownerNode бывает и не элементом (<?xml-stylesheet?>) — у такого нет атрибутов
    if (ownerNode?.nodeType !== Node.ELEMENT_NODE || isOwnStyle(ownerNode) || processedStylesheets.has(stylesheet)) continue;
    if (isExtensionStylesheet(ownerNode)) {
      processedStylesheets.add(stylesheet);
      continue;
    }

    if (stylesheet.href) {
      try {
        if (KNOWN_STYLESHEET_PATHS.has(new URL(stylesheet.href).pathname)) {
          processedStylesheets.add(stylesheet);
          continue;
        }
      } catch {
        // Битый href — проверим как незнакомую таблицу
      }
    }

    let ruleList;
    try {
      ruleList = stylesheet.cssRules;
    } catch {
      // Таблица с чужого домена — её правила не читаются
      processedStylesheets.add(stylesheet);
      continue;
    }
    processedStylesheets.add(stylesheet);
    collectConvertedRules(ruleList, addedRules);
  }

  if (addedRules.length) {
    const styleElement = document.createElement('style');
    styleElement.setAttribute(DYNAMIC_STYLE_ATTRIBUTE, '');
    styleElement.textContent = addedRules.join('\n');
    applyThemeState(styleElement);
    dynamicStyleElements.push(styleElement);
  }
  placeDynamicStyles();
}

/**
 * Ставит порции пересчитанных правил после `<body>` и перед основным стилем темы. Порция, вставленная ещё до
 * появления `<body>`, оказалась бы перед ним, и стили из `<body>` её перебили бы — такую переносим.
 */
function placeDynamicStyles() {
  for (const styleElement of dynamicStyleElements) {
    const isAfterBody = !document.body || Boolean(document.body.compareDocumentPosition(styleElement) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (styleElement.parentNode === document.documentElement && isAfterBody) continue;
    document.documentElement.insertBefore(styleElement, themeStyleElement);
  }
}

/**
 * Включает или выключает тег темы под текущее состояние: выключенная тема на лету остаётся в DOM, но не действует.
 * Пересчёт новых таблиц стилей при этом продолжается, чтобы при включении тема сразу была полной.
 * @param {HTMLStyleElement} styleElement Основной стиль темы или порция пересчитанных правил.
 */
function applyThemeState(styleElement) {
  if (isThemeEnabled) styleElement.removeAttribute('media');
  else styleElement.media = 'not all';
}

/**
 * Свои теги темы — основной стиль и порции пересчитанных правил — не пересчитываются.
 * @param {Element} element Тег `<style>` или `<link>`.
 * @returns {boolean} Принадлежит ли тег самой теме.
 */
function isOwnStyle(element) {
  return element === themeStyleElement || element.hasAttribute(DYNAMIC_STYLE_ATTRIBUTE);
}

/**
 * Документ фрейма, если он с того же домена.
 * @param {HTMLIFrameElement} frame Фрейм.
 * @returns {Document|null} Документ или `null` для чужого домена.
 */
function getFrameDocument(frame) {
  try {
    return frame.contentDocument;
  } catch {
    return null;
  }
}

/**
 * Перекрашивает фрейм без своего скрипта темы: пересчитывает все его таблицы стилей заново (документ редактора
 * маленький) и ставит `color-scheme: dark` — иначе Chrome заливает фрейм со схемой, отличной от страницы, белым.
 * @param {HTMLIFrameElement} frame Фрейм.
 */
function themeFrame(frame) {
  // На паузе не пересчитываем: слайдеры — целые страницы портала, а их правила всё равно не применятся
  if (!isThemeEnabled) return;

  const frameDocument = getFrameDocument(frame);
  const root = frameDocument?.documentElement;
  if (!root || root.hasAttribute('data-pts-bitrix-dark-theme')) return;

  let styleElement = frameDocument.querySelector(`style[${FRAME_STYLE_ATTRIBUTE}]`);
  // Тёмные версии переменных есть только в документе с темой — во фрейме пересчитываем лишь явные цвета
  const rules = [':root{color-scheme:dark}'];
  for (const stylesheet of frameDocument.styleSheets) {
    if (stylesheet.ownerNode === styleElement) continue;
    try {
      collectConvertedRules(stylesheet.cssRules, rules, false);
    } catch {
      // Таблица с чужого домена — её правила не читаются
    }
  }

  if (!styleElement) {
    styleElement = frameDocument.createElement('style');
    styleElement.setAttribute(FRAME_STYLE_ATTRIBUTE, '');
  }
  styleElement.textContent = rules.join('\n');
  applyThemeState(styleElement);
  // После <body>, как и основной стиль темы: копия правила перебивает оригинал, только если идёт позже
  if (root.lastChild !== styleElement) root.append(styleElement);

  // Стили документов, стёртых document.open(), больше не нужны
  for (const element of frameStyleElements) {
    if (!element.isConnected) frameStyleElements.delete(element);
  }
  frameStyleElements.add(styleElement);
}

/**
 * Перекрашивает все фреймы страницы заново — после включения темы: на паузе фреймы не перекрашивались.
 * Вызывается из обёртки в scripts/pack.mjs.
 */
// eslint-disable-next-line no-unused-vars
function themeAllFrames() {
  for (const frame of frameElements) themeFrame(frame);
}

/**
 * Перекрашивает новые фреймы страницы и следит за ними: редактор перезаписывает документ фрейма через
 * document.open(), и перезапись заканчивается событием `load` — к нему же догружаются `<link>` фрейма.
 */
function watchNewFrames() {
  for (const frame of frameElements) {
    if (watchedFrames.has(frame)) continue;
    watchedFrames.add(frame);
    frame.addEventListener('load', () => themeFrame(frame));
    themeFrame(frame);
  }
}

// Несколько новых таблиц за кадр пересчитываем одним проходом
let isScanQueued = false;
function queueScan() {
  if (isScanQueued) return;
  isScanQueued = true;
  requestAnimationFrame(() => {
    isScanQueued = false;
    scanNewStylesheets();
  });
}

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // У <style> поменяли текст — браузер создал для него новую таблицу стилей, её тоже надо пересчитать
    if (mutation.target.nodeName === 'STYLE' && !isOwnStyle(mutation.target)) queueScan();
    for (const node of mutation.addedNodes) {
      // Правила <link> доступны только после загрузки, <style> — сразу
      if (node.nodeName === 'LINK') node.addEventListener('load', queueScan, {once: true});
      else if (node.nodeName === 'STYLE' && !isOwnStyle(node)) queueScan();
    }
  }
  if (frameElements.length) watchNewFrames();
}).observe(document.documentElement, {childList: true, subtree: true});
document.addEventListener('DOMContentLoaded', queueScan);
window.addEventListener('load', queueScan);
// Тему включили на уже загруженной странице — таблицы стилей уже на месте, событий загрузки не будет
if (document.readyState !== 'loading') queueScan();
watchNewFrames();
