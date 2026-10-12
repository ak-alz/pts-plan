// Общие настройки и хелперы шагов генератора: адрес портала, палитра темы, пути, чтение скачанного CSS.
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

/** Портал, с которого снимаются стили. */
export const PORTAL_ORIGIN = 'https://plan.pixelplus.ru';

// Корень инструмента (tools/bitrix-dark-theme): пути считаются от него, а не от папки, из которой запущен скрипт
const TOOL_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIRECTORY = path.join(TOOL_DIRECTORY, 'build');

/** Пути к файлам генератора. */
export const PATHS = {
  // Правятся руками
  stylesheetList: path.join(TOOL_DIRECTORY, 'config/paths.json'),
  extraCss: path.join(TOOL_DIRECTORY, 'config/extra.css'),
  // Код подстраховки, который pack.mjs вставляет в скрипт темы
  runtime: path.join(TOOL_DIRECTORY, 'runtime/runtime.js'),
  // Промежуточные файлы сборки — в .gitignore
  css: path.join(BUILD_DIRECTORY, 'css'),
  page: path.join(BUILD_DIRECTORY, 'page.html'),
  darkReaderCss: path.join(BUILD_DIRECTORY, 'darkReader.css'),
  rgbVariablesCss: path.join(BUILD_DIRECTORY, 'rgbVariables.css'),
  masksCss: path.join(BUILD_DIRECTORY, 'masks.css'),
  iconsCss: path.join(BUILD_DIRECTORY, 'icons.css'),
  // Результат — скрипт темы в ассетах расширения
  output: path.resolve(TOOL_DIRECTORY, '../../public/assets/bitrix-dark-theme.js'),
};

/**
 * Записывает файл, создавая недостающие папки: шаги можно запускать и по отдельности, до fetch.mjs.
 * @param {string} filePath Путь к файлу.
 * @param {string} content Содержимое.
 */
export function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, content);
}

/**
 * Палитра темы: фон — как у тёмной темы GitHub (dimmed), текст чуть ярче, чем там (#adbac7 был слишком бледным).
 * Мягче стандартной палитры Dark Reader (#181a1b / #e8e6e3).
 * runtime.js повторяет её своими числами: он вставляется в скрипт темы текстом и импортировать отсюда не может.
 */
export const PALETTE = {
  background: '#22272e',
  text: '#cdd9e5',
};

/**
 * Читает список таблиц стилей портала, из которых собирается тема.
 * @returns {string[]} Пути от корня портала, например `/bitrix/js/ui/buttons/dist/ui.buttons.bundle.min.css`.
 */
export function readStylesheetPaths() {
  return JSON.parse(fs.readFileSync(PATHS.stylesheetList, 'utf8'));
}

/**
 * Путь к локальной копии таблицы стилей, скачанной fetch.mjs.
 * @param {string} stylesheetPath Путь таблицы стилей от корня портала.
 * @returns {string} Путь к файлу в `build/css/` (слеши заменены на `_`).
 */
export function getLocalCssFile(stylesheetPath) {
  return path.join(PATHS.css, stylesheetPath.replace(/\//g, '_'));
}

/**
 * Читает все скачанные таблицы стилей.
 * @returns {string[]} Содержимое каждого файла из `build/css/`.
 */
export function readLocalCssFiles() {
  return fs.readdirSync(PATHS.css).map((fileName) => fs.readFileSync(path.join(PATHS.css, fileName), 'utf8'));
}

/**
 * Убирает из CSS комментарии.
 * @param {string} css Исходный CSS.
 * @returns {string} CSS без комментариев.
 */
export function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Перебирает простые правила `селектор { объявления }` в CSS. Правила внутри @media и прочих групп тоже
 * попадают (как отдельные правила, без обёртки), сами @-правила — нет.
 * @param {string} css CSS без комментариев.
 * @returns {Generator<{selector: string, declarations: string}>} Селектор (без обрезки пробелов) и текст объявлений.
 */
export function* iterateCssRules(css) {
  for (const match of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    yield {selector: match[1], declarations: match[2]};
  }
}

/**
 * Переводит hex-цвет в каналы для `rgba(…)`.
 * @param {string} hex Цвет вида `#22272e`.
 * @returns {string} Каналы через запятую, например `34,39,46`.
 */
export function hexToRgbChannels(hex) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(',');
}
