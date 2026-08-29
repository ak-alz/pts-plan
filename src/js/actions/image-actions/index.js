import {showToast} from '../../toastHost/showToast.js';
import {insertCSS, rehydrateOnChanges, waitForElement} from '../../utils.js';

const DESCRIPTION_SELECTOR = '.task-detail-description';

// Инлайн-изображение Диска в тексте: адрес оригинала лежит в data-src (action=download), имя файла —
// в data-title. Прочие вложения размечены так же, но с другим data-viewer-type — их не берём
const IMAGE_CONTAINERS = [DESCRIPTION_SELECTOR, '.feed-com-text-inner-inner'];
const IMAGE_SELECTOR = IMAGE_CONTAINERS
  .map((container) => `${container} img[data-viewer-type="image"][data-src]`)
  .join(', ');

// За чем следим, чтобы поймать изображения, которых при первом проходе ещё не было. Оба контейнера
// Bitrix дорисовывает уже после того, как контент-скрипт отработал, поэтому каждого ждём отдельно:
// порядок их появления не гарантирован, а пропущенный контейнер повторить было бы некому.
// У комментариев наблюдаем родителя ленты, а не текст одного комментария: догруженные кнопкой
// «Ещё» приходят соседними узлами и внутрь уже существующего текста не попадают
const OBSERVED_CONTAINERS = [
  {selector: DESCRIPTION_SELECTOR, getObservedElement: (element) => element},
  {selector: '.feed-com-header, .feed-com-block-cover', getObservedElement: (element) => element.parentElement},
];

const PROCESSED_ATTRIBUTE = 'data-pts-image-actions';

const COPY_ICON = 'pi-copy';
const DOWNLOAD_ICON = 'pi-download';

(() => {
  insertCSS(`
    .pts-image-actions {
      position: relative;
      display: inline-block;
      line-height: 0;
      max-width: 100%;
    }

    .pts-image-actions__panel {
      position: absolute;
      top: 6px;
      right: 6px;
      display: flex;
      gap: 4px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
    }

    .pts-image-actions:hover .pts-image-actions__panel {
      opacity: 1;
      visibility: visible;
    }

    .pts-image-actions__button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      transition: background 0.2s;
    }

    .pts-image-actions__button:hover {
      background: rgba(0, 0, 0, 0.8);
    }

    .pts-image-actions__button:disabled {
      opacity: 0.7;
      cursor: default;
    }
  `, 'pts-image-actions');

  /**
   * Имя файла изображения: сначала подпись Диска, затем alt, затем имя из самого адреса скачивания
   * и только потом запасное. Из адреса — чтобы не подсунуть браузеру расширение .png для файла,
   * который на самом деле jpeg: скачивается-то оригинал как есть.
   * @param {HTMLImageElement} image изображение в тексте
   * @return {string}
   */
  function getFileName(image) {
    return image.dataset.title || image.alt || getFileNameFromUrl(image.dataset.src) || 'image';
  }

  /**
   * Вытаскивает имя файла из адреса скачивания Диска: у него оно лежит либо в параметре filename,
   * либо последним сегментом пути. Не нашлось — вернём пустую строку, вызывающий подставит своё.
   * @param {string} url адрес из data-src
   * @return {string}
   */
  function getFileNameFromUrl(url) {
    try {
      const {searchParams, pathname} = new URL(url, window.location.origin);
      const fromQuery = searchParams.get('filename');
      if (fromQuery) return fromQuery;

      const lastSegment = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '');
      return lastSegment.includes('.') ? lastSegment : '';
    } catch {
      return '';
    }
  }

  /**
   * Буфер обмена Chrome принимает только PNG, остальные форматы перерисовываем.
   * @param {Blob} blob исходный файл изображения
   * @return {Promise<Blob>}
   */
  async function toPngBlob(blob) {
    if (blob.type === 'image/png') return blob;

    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();

    return canvas.convertToBlob({type: 'image/png'});
  }

  async function fetchImageBlob(url) {
    const response = await fetch(url, {credentials: 'include'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return response.blob();
  }

  /**
   * Копирует оригинал изображения в буфер обмена.
   * @param {HTMLImageElement} image изображение в тексте
   * @param {HTMLButtonElement} button кнопка копирования — на время запроса показывает загрузку
   */
  function copyImage(image, button) {
    // Блоб отдаём промисом внутрь ClipboardItem: await перед clipboard.write съел бы жест
    // пользователя, и Chrome ответил бы NotAllowedError
    const pngBlob = fetchImageBlob(image.dataset.src).then(toPngBlob);

    button.disabled = true;
    button.innerHTML = '<i class="pi pi-spinner pi-spin"></i>';

    navigator.clipboard.write([new ClipboardItem({'image/png': pngBlob})])
      .then(() => showToast({severity: 'success', summary: 'Изображение скопировано', life: 2000}))
      .catch((error) => {
        console.warn('[pts-plan] imageActions', error);
        showToast({severity: 'error', summary: 'Не удалось скопировать изображение', life: 3000});
      })
      .finally(() => {
        button.disabled = false;
        button.innerHTML = `<i class="pi ${COPY_ICON}"></i>`;
      });
  }

  /**
   * Скачивает оригинал изображения. Файл не выкачиваем в память: data-src — это адрес скачивания
   * на самом Диске, браузеру достаточно перейти по нему.
   * @param {HTMLImageElement} image изображение в тексте
   */
  function downloadImage(image) {
    Object.assign(document.createElement('a'), {
      href: image.dataset.src,
      download: getFileName(image),
    }).click();
  }

  function createButton(icon, title, onClick) {
    const button = Object.assign(document.createElement('button'), {
      type: 'button',
      className: 'pts-image-actions__button',
      title,
      innerHTML: `<i class="pi ${icon}"></i>`,
    });

    button.addEventListener('click', (event) => {
      // Клик по изображению открывает просмотрщик Битрикса — до него событие доходить не должно
      event.preventDefault();
      event.stopPropagation();
      onClick(button);
    });

    return button;
  }

  /**
   * Оборачивает изображение и вешает поверх него панель кнопок. Повторный вызов на том же изображении
   * ничего не делает — метка остаётся на самом изображении, а не на обёртке.
   * @param {HTMLImageElement} image изображение в тексте
   */
  function addImageActions(image) {
    if (image.hasAttribute(PROCESSED_ATTRIBUTE)) return;
    image.setAttribute(PROCESSED_ATTRIBUTE, '');

    const wrapper = Object.assign(document.createElement('span'), {className: 'pts-image-actions'});
    image.replaceWith(wrapper);
    wrapper.appendChild(image);

    const panel = Object.assign(document.createElement('span'), {className: 'pts-image-actions__panel'});
    panel.append(
      createButton(COPY_ICON, 'Скопировать изображение', (button) => copyImage(image, button)),
      createButton(DOWNLOAD_ICON, 'Скачать изображение', () => downloadImage(image)),
    );

    wrapper.appendChild(panel);
  }

  function addActionsToImages() {
    document.querySelectorAll(IMAGE_SELECTOR).forEach(addImageActions);
  }

  /**
   * Дожидается своего контейнера, обрабатывает изображения и подписывается на его изменения.
   * Проход по появлению каждого контейнера свой, потому что второй мог отрисоваться позже первого;
   * повторные проходы безвредны — обработанные изображения отсекает метка на самом изображении.
   * @param {{selector: string, getObservedElement: function(Element): Element|null}} container
   */
  async function watchContainer({selector, getObservedElement}) {
    const element = await waitForElement(selector);
    if (!element) return;

    addActionsToImages();

    const observedElement = getObservedElement(element);
    if (observedElement) rehydrateOnChanges(addActionsToImages, observedElement);
  }

  OBSERVED_CONTAINERS.forEach(watchContainer);
})();
