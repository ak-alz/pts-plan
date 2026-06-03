// Превью функций (гифки) для быстрой настройки и подсказок опций.
// Файлы лежат в src/assets/setup/<key>.webm, имя файла = ключ опции/фичи из options.js.
const modules = import.meta.glob('../assets/setup/*.webm', {eager: true, import: 'default'});

const previewByKey = {};
for (const [path, url] of Object.entries(modules)) {
  previewByKey[path.split('/').pop().replace('.webm', '')] = url;
}

/**
 * Возвращает URL превью-гифки для ключа опции/фичи.
 * @param {string} key - Ключ опции из options.js.
 * @returns {string|null} URL гифки или null, если файла нет.
 */
export function getPreview(key) {
  return previewByKey[key] ?? null;
}
