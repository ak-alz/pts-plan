// Шаг 1: скачивает CSS портала из config/paths.json в build/css/ — по этим файлам остальные шаги ищут rgba-переменные,
// маски, иконки и исходные CSS-переменные. Файлы публичные, авторизация не нужна.
import fs from 'fs';

import {getLocalCssFile, PATHS, PORTAL_ORIGIN, readStylesheetPaths, writeFile} from '../lib/shared.mjs';

// Сотни запросов разом портал частично отбрасывает — качаем ограниченным числом потоков
const CONCURRENT_DOWNLOADS = 6;
const MAX_ATTEMPTS = 3;
// Пауза перед повторной попыткой растёт с каждой попыткой: 1 с, 2 с…
const RETRY_DELAY_MS = 1000;

/**
 * Скачивает одну таблицу стилей с повторными попытками.
 * @param {string} stylesheetPath Путь таблицы стилей от корня портала.
 * @returns {Promise<string|null>} Текст CSS или `null`, если файл так и не скачался; причина — в консоли.
 */
async function downloadStylesheet(stylesheetPath) {
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(PORTAL_ORIGIN + stylesheetPath);
      if (response.ok) return await response.text();
      lastError = `HTTP ${response.status}`;
      // Файла нет — повтор не поможет
      if (response.status === 404) break;
    } catch (error) {
      lastError = error.cause?.code || error.message;
    }
    if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
  }
  console.warn('не скачался', stylesheetPath, `(${lastError})`);
  return null;
}

const stylesheetPaths = readStylesheetPaths();
fs.rmSync(PATHS.css, {recursive: true, force: true});
fs.mkdirSync(PATHS.css, {recursive: true});

// Общая очередь на несколько потоков: каждый берёт следующий путь, пока очередь не опустеет
const queue = [...stylesheetPaths];
let failedCount = 0;
async function downloadWorker() {
  while (queue.length) {
    const stylesheetPath = queue.shift();
    const css = await downloadStylesheet(stylesheetPath);
    if (css === null) failedCount++;
    else writeFile(getLocalCssFile(stylesheetPath), css);
  }
}
await Promise.all(Array.from({length: CONCURRENT_DOWNLOADS}, downloadWorker));

console.log('скачано', stylesheetPaths.length - failedCount, 'из', stylesheetPaths.length);
// Не скачалось ничего — скорее всего нет сети, и без остановки сборка тихо выпустила бы пустую тему.
// Отдельные пропуски (Битрикс убрал модуль) не критичны, но такой путь стоит убрать из config/paths.json.
if (failedCount === stylesheetPaths.length) {
  throw new Error(`Не скачался ни один CSS-файл — проверьте доступ к ${PORTAL_ORIGIN}`);
}
