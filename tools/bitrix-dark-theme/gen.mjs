/* global DarkReader */
// Прогоняет Dark Reader по CSS Битрикса в headless Chrome и сохраняет сгенерированный CSS.
import fs from 'fs';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const paths = JSON.parse(fs.readFileSync('paths.json', 'utf8'));
const html = `<!doctype html><html><head><meta charset="utf-8">${paths.map(p =>
  `<link rel="stylesheet" href="https://plan.pixelplus.ru${p}">`).join('')}</head>
<body class="template-bitrix24 template-air bitrix24-light-theme --ui-context-edge-dark"><div>x</div></body></html>`;
fs.writeFileSync('page.html', html);
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true, args: ['--disable-web-security', '--allow-file-access-from-files', '--user-data-dir=/tmp/pd-chrome'],
});
const page = await browser.newPage();
await page.goto('file://' + process.cwd() + '/page.html', { waitUntil: 'networkidle0', timeout: 120000 });
await page.addScriptTag({ path: 'node_modules/darkreader/darkreader.js' });
const css = await page.evaluate(async () => {
  DarkReader.setFetchMethod(window.fetch);
  // Палитра помягче стандартной (#181a1b / #e8e6e3) — как тёмная тема GitHub (dimmed).
  DarkReader.enable({ brightness: 100, contrast: 100, sepia: 0, darkSchemeBackgroundColor: '#22272e', darkSchemeTextColor: '#adbac7' });
  let prev = -1;
  for (let i = 0; i < 60; i++) { // ждём, пока вывод перестанет расти
    await new Promise(r => setTimeout(r, 1000));
    const len = (await DarkReader.exportGeneratedCSS()).length;
    if (len === prev && len > 10000) break;
    prev = len;
  }
  return DarkReader.exportGeneratedCSS();
});
fs.writeFileSync('dr.css', css);
console.log('bytes', css.length);
await browser.close();
