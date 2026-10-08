// Скачивает CSS портала из paths.json в css/ — по ним считаются rgbvars/masks/icons и исходные переменные.
// Файлы публичные, авторизация не нужна.
import fs from 'fs';

const ORIGIN = 'https://plan.pixelplus.ru';
const paths = JSON.parse(fs.readFileSync('paths.json', 'utf8'));
fs.rmSync('css', { recursive: true, force: true });
fs.mkdirSync('css');

let failed = 0;
await Promise.all(paths.map(async (path) => {
  const response = await fetch(ORIGIN + path).catch(() => null);
  if (!response?.ok) { failed++; console.warn('не скачался', path); return; }
  fs.writeFileSync('css/' + path.replace(/\//g, '_'), await response.text());
}));
console.log('скачано', paths.length - failed, 'из', paths.length);
