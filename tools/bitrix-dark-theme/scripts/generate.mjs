/* global DarkReader */
// Шаг 2: прогоняет Dark Reader по CSS портала в headless Chrome и сохраняет сгенерированный им CSS в build/darkReader.css.
import fs from 'fs';
import {createRequire} from 'module';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer-core';
import {pathToFileURL} from 'url';

import {PALETTE, PATHS, PORTAL_ORIGIN, readStylesheetPaths, writeFile} from '../lib/shared.mjs';

// Где искать Chrome, если путь не задан переменной окружения CHROME_PATH
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
// Сколько секунд максимум ждать, пока Dark Reader обработает все стили
const MAX_WAIT_SECONDS = 60;
// Вывод короче этого считаем недоделанным, даже если он перестал расти
const MIN_GENERATED_CSS_LENGTH = 10000;

const chromePath = process.env.CHROME_PATH || CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
if (!chromePath) {
  throw new Error('Chrome не найден — укажите путь к нему в переменной окружения CHROME_PATH');
}

const stylesheetLinks = readStylesheetPaths()
  .map((stylesheetPath) => `<link rel="stylesheet" href="${PORTAL_ORIGIN}${stylesheetPath}">`)
  .join('');
// Классы body — как на портале: от них зависят селекторы части стилей
const pageHtml = `<!doctype html><html><head><meta charset="utf-8">${stylesheetLinks}</head>
<body class="template-bitrix24 template-air bitrix24-light-theme --ui-context-edge-dark"><div>x</div></body></html>`;
writeFile(PATHS.page, pageHtml);

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: [
    // Dark Reader читает правила стилей с портала — без этого их не дал бы CORS
    '--disable-web-security',
    '--allow-file-access-from-files',
    `--user-data-dir=${path.join(os.tmpdir(), 'bitrix-dark-theme-chrome')}`,
  ],
});
const page = await browser.newPage();
await page.goto(pathToFileURL(PATHS.page).href, {waitUntil: 'networkidle0', timeout: 120000});
// Путь к сборке Dark Reader — через резолв пакета, а не от текущей папки: не зависит от того, откуда запущен скрипт
await page.addScriptTag({path: createRequire(import.meta.url).resolve('darkreader')});

const generatedCss = await page.evaluate(async (palette, maxWaitSeconds, minGeneratedCssLength) => {
  DarkReader.setFetchMethod(window.fetch);
  DarkReader.enable({
    brightness: 100,
    contrast: 100,
    sepia: 0,
    darkSchemeBackgroundColor: palette.background,
    darkSchemeTextColor: palette.text,
  });

  // Dark Reader обрабатывает стили асинхронно — ждём, пока вывод перестанет расти
  let previousLength = -1;
  for (let second = 0; second < maxWaitSeconds; second++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const currentLength = (await DarkReader.exportGeneratedCSS()).length;
    if (currentLength === previousLength && currentLength > minGeneratedCssLength) break;
    previousLength = currentLength;
  }
  return DarkReader.exportGeneratedCSS();
}, PALETTE, MAX_WAIT_SECONDS, MIN_GENERATED_CSS_LENGTH);

await browser.close();
if (generatedCss.length <= MIN_GENERATED_CSS_LENGTH) {
  throw new Error(`Dark Reader выдал всего ${generatedCss.length} байт CSS — стили портала, видимо, не загрузились`);
}
writeFile(PATHS.darkReaderCss, generatedCss);
console.log('байт', generatedCss.length);
