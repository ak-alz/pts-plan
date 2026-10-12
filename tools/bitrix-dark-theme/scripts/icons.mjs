// Шаг 5: иконки фоновыми картинками (SVG). Живой Dark Reader перекрашивает тёмные иконки на лету, статичный
// CSS — нет, и они теряются на тёмном фоне. Берём только SVG, где ВСЕ цвета тёмные, и выдаём перекрашенную
// копию под тем же селектором (build/icons.css): светлота зеркалится, оттенок сохраняется. Цветные и светлые
// картинки не трогаем.
import fs from 'fs';

import {getLocalCssFile, iterateCssRules, PATHS, PORTAL_ORIGIN, readStylesheetPaths, stripCssComments, writeFile} from '../lib/shared.mjs';

const NAMED_COLORS = {black: '#000000', white: '#ffffff'};
// Цвет в атрибуте или CSS-свойстве SVG: fill="#000", stroke:black, stop-color='rgb(…)'
const SVG_COLOR_PATTERN = /(fill|stroke|stop-color|color)\s*[=:]\s*["']?(#[0-9a-f]{3,6}\b|rgba?\([^)]*\)|black|white)/gi;
const SVG_SHAPE_PATTERN = /<(path|circle|rect|polygon|ellipse|line|polyline)\b/i;
// Растровые вставки, ссылки на определения и градиенты — такие картинки простой перекраской не исправить
const COMPLEX_SVG_PATTERN = /<image\b|url\(#|<(linear|radial)Gradient/i;
// Заливка для SVG без явной: по умолчанию браузер заливает фигуры чёрным
const DEFAULT_FILL = '#c9d1d9';
// В какой диапазон светлоты попадает перекрашенная иконка
const MIN_LIGHTNESS = 0.62;
const MAX_LIGHTNESS = 0.88;
// Фон с картинкой: background или background-image с url(…)
const BACKGROUND_IMAGE_PATTERN = /background(?:-image)?\s*:[^;]*?url\(\s*(["']?)(.*?)\1\s*\)/;
// Лоадеры и скелетоны правятся в config/extra.css, маски — в masks.mjs
const SKIPPED_SELECTOR_PATTERN = /loader|skeleton|mask/i;

/**
 * Разбирает цвет из SVG.
 * @param {string} color `#rgb`, `#rrggbb`, `rgb(…)`/`rgba(…)`, `black` или `white`.
 * @returns {number[]|null} Каналы `[red, green, blue]` 0–255 или `null`, если формат не поддержан.
 */
function parseColor(color) {
  const normalizedColor = NAMED_COLORS[color.toLowerCase()] || color;
  const hexMatch = normalizedColor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = [...hex].map((digit) => digit + digit).join('');
    return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  }
  const rgbMatch = normalizedColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return rgbMatch ? [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])] : null;
}

/**
 * Переводит цвет из RGB в HSL.
 * @param {number[]} rgb Каналы `[red, green, blue]` 0–255.
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
 * Переводит цвет из HSL в hex.
 * @param {number[]} hsl `[hue, saturation, lightness]`, каждый 0–1.
 * @returns {string} Цвет вида `#rrggbb`.
 */
function hslToHex([hue, saturation, lightness]) {
  const amplitude = saturation * Math.min(lightness, 1 - lightness);
  const getChannel = (offset) => {
    const position = (offset + hue * 12) % 12;
    return Math.round(255 * (lightness - amplitude * Math.max(-1, Math.min(position - 3, 9 - position, 1))));
  };
  return '#' + [getChannel(0), getChannel(8), getChannel(4)].map((channel) => channel.toString(16).padStart(2, '0')).join('');
}

/**
 * Делает из тёмного цвета светлый того же оттенка: светлота зеркалится и зажимается в диапазон.
 * @param {number[]} rgb Каналы `[red, green, blue]` 0–255.
 * @returns {string} Цвет вида `#rrggbb`.
 */
function toLightColor(rgb) {
  const [hue, saturation, lightness] = rgbToHsl(rgb);
  return hslToHex([hue, saturation, Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, 1 - lightness))]);
}

/**
 * Перекрашивает тёмную SVG-иконку в светлую.
 * @param {string} svg Разметка SVG.
 * @returns {string|null} Перекрашенная разметка или `null`, если иконку трогать не нужно.
 */
function recolorSvg(svg) {
  if (!SVG_SHAPE_PATTERN.test(svg) || COMPLEX_SVG_PATTERN.test(svg)) return null;
  const colors = [...svg.matchAll(SVG_COLOR_PATTERN)].map((match) => parseColor(match[2])).filter(Boolean);
  // Есть хоть один светлый или яркий цвет — иконка и так видна на тёмном фоне
  if (colors.length && !colors.every((rgb) => rgbToHsl(rgb)[2] < 0.5)) return null;

  let recoloredSvg = svg.replace(SVG_COLOR_PATTERN, (match, _property, color) => {
    const rgb = parseColor(color);
    return rgb ? match.replace(color, toLightColor(rgb)) : match;
  });
  if (!/fill\s*[=:]/i.test(svg)) recoloredSvg = recoloredSvg.replace(/<svg\b/i, `<svg fill="${DEFAULT_FILL}"`);
  return recoloredSvg;
}

/**
 * Достаёт разметку SVG из data-URL.
 * @param {string} url `data:image/svg+xml,…` — в base64 или URL-кодировке.
 * @returns {string|null} Разметка SVG или `null`, если это не SVG data-URL.
 */
function decodeSvgDataUrl(url) {
  const match = url.match(/^data:image\/svg\+xml(;[^,]*)?,(.*)$/s);
  if (!match) return null;
  const [, parameters = '', data] = match;
  if (/base64/.test(parameters)) return Buffer.from(data, 'base64').toString('utf8');
  try {
    // Одиночный «%» без двух hex-цифр после него уронил бы decodeURIComponent
    return decodeURIComponent(data.replace(/%(?![0-9a-f]{2})/gi, '%25'));
  } catch {
    // Битая кодировка (например, обрезанный UTF-8) — картинку пропускаем, а не роняем всю сборку
    return null;
  }
}

/**
 * Абсолютный адрес картинки из url() таблицы стилей.
 * @param {string} imageUrl Адрес из CSS, может быть относительным.
 * @param {string} stylesheetUrl Адрес таблицы стилей — от него считаются относительные адреса.
 * @returns {string|null} Абсолютный адрес или `null`, если адрес не разбирается.
 */
function resolveImageUrl(imageUrl, stylesheetUrl) {
  try {
    return new URL(imageUrl, stylesheetUrl).href;
  } catch {
    return null;
  }
}

/**
 * Кодирует SVG для data-URL внутри `url("…")`. Экранирует только то, что сломало бы адрес или строку CSS:
 * encodeURIComponent кодировал бы и пробелы, и `=`, и кавычки — почти втрое длиннее.
 * @param {string} svg Разметка SVG.
 * @returns {string} Строка для подстановки после `data:image/svg+xml;charset=utf-8,`.
 */
function encodeSvgForCss(svg) {
  return svg
    .replace(/\s+/g, ' ')
    .replace(/"/g, '\'')
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
}

// Одна и та же картинка встречается во многих правилах — скачиваем её один раз
const svgCache = new Map();

/**
 * Скачивает SVG-файл, с кэшем по адресу.
 * @param {string} url Абсолютный адрес картинки.
 * @returns {Promise<string|null>} Разметка SVG или `null`, если файл не скачался.
 */
function loadSvg(url) {
  if (!svgCache.has(url)) {
    svgCache.set(url, fetch(url).then((response) => (response.ok ? response.text() : null)).catch(() => null));
  }
  return svgCache.get(url);
}

const iconRules = new Set();
let imagesCount = 0;
for (const stylesheetPath of readStylesheetPaths()) {
  const localFile = getLocalCssFile(stylesheetPath);
  if (!fs.existsSync(localFile)) continue;
  const css = stripCssComments(fs.readFileSync(localFile, 'utf8'));
  // Относительные url() считаются от адреса самой таблицы стилей
  const stylesheetUrl = PORTAL_ORIGIN + stylesheetPath;

  for (const rule of iterateCssRules(css)) {
    const backgroundMatch = rule.declarations.match(BACKGROUND_IMAGE_PATTERN);
    if (!backgroundMatch) continue;
    if (/gradient/.test(rule.declarations) || SKIPPED_SELECTOR_PATTERN.test(rule.selector)) continue;

    const imageUrl = backgroundMatch[2];
    imagesCount++;
    let svg = null;
    if (imageUrl.startsWith('data:image/svg')) svg = decodeSvgDataUrl(imageUrl);
    else if (/\.svg(\?|$)/i.test(imageUrl)) {
      const absoluteUrl = resolveImageUrl(imageUrl, stylesheetUrl);
      if (absoluteUrl) svg = await loadSvg(absoluteUrl);
    }
    if (!svg) continue;

    const recoloredSvg = recolorSvg(svg);
    if (!recoloredSvg) continue;
    iconRules.add(`${rule.selector.trim()}{background-image:url("data:image/svg+xml;charset=utf-8,${encodeSvgForCss(recoloredSvg)}")}`);
  }
}

writeFile(PATHS.iconsCss, [...iconRules].join('\n'));
console.log('картинок', imagesCount, 'перекрашено', iconRules.size);
