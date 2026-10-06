// Промисы загрузки по пути скрипта: каждый мост инжектится один раз на страницу
const loadPromises = new Map();

/**
 * Инжектит скрипт расширения в main world страницы — туда, где доступны `BX` и объекты редакторов
 * Bitrix. Повторный вызов с тем же путём не грузит скрипт заново. Путь должен быть перечислен
 * в `web_accessible_resources` манифеста.
 * @param {string} path Путь к скрипту внутри расширения, например `src/content-scripts/editor-bridge.js`
 * @returns {Promise<boolean>} `true`, если скрипт загрузился
 */
export function loadMainWorldScript(path) {
  if (loadPromises.has(path)) return loadPromises.get(path);

  const loadPromise = new Promise((resolve) => {
    const script = Object.assign(document.createElement('script'), {
      src: chrome.runtime.getURL(path),
      type: 'module',
    });

    script.onload = () => {
      script.remove();
      resolve(true);
    };
    script.onerror = () => {
      script.remove();
      // Неудачу не запоминаем — следующий вызов попробует снова
      loadPromises.delete(path);
      resolve(false);
    };

    document.head.appendChild(script);
  });

  loadPromises.set(path, loadPromise);
  return loadPromise;
}
