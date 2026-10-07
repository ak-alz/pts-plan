// Файлы Диска в визуальном редакторе (BbcodeEditor): сведения о картинках для плагина File,
// список вложений с загрузкой на Диск и прикрепление их к задаче
import {computed, reactive, toRaw} from 'vue';

import {DISK_FILE_TAG_RE} from './patterns.js';

// Шире превью в редакторе не нужно: в блок описания всё равно не влезет
const MAX_PREVIEW_WIDTH = 1024;

function buildImageInfo({serverFileId, objectId, name, src, width, height, previewWidth, previewHeight}) {
  return {
    serverFileId,
    isImage: true,
    isVideo: false,
    name,
    src,
    previewUrl: src,
    width,
    height,
    previewWidth,
    previewHeight,
    customData: {objectId: Number(objectId)},
  };
}

/**
 * ID файлов Диска из тегов текста — в нижнем регистре, как их удобно сравнивать: редактор пишет
 * теги строчными (`[disk file id=n123]`), а Bitrix — заглавными.
 * @param {string} text BBCode
 * @returns {Set<string>}
 */
export function getDiskFileIds(text) {
  return new Set([...String(text ?? '').matchAll(DISK_FILE_TAG_RE)].map((match) => match[1].toLowerCase()));
}

/**
 * Снимает со страницы картинки, уже вставленные в описание: у Bitrix в разметке есть и ID файла,
 * и готовая ссылка на превью, так что отдельные запросы не нужны.
 * @param {HTMLElement} descriptionElement
 * @returns {object[]}
 */
export function collectPageImages(descriptionElement) {
  return [...descriptionElement.querySelectorAll('img[data-object-id]')].map((image) => ({
    objectId: image.dataset.objectId,
    attachedObjectId: image.dataset.attachedObjectId,
    name: image.dataset.title || image.alt || '',
    src: image.src,
    width: Number(image.dataset.bxFullWidth) || image.naturalWidth,
    height: Number(image.dataset.bxFullHeight) || image.naturalHeight,
    previewWidth: Number(image.dataset.bxWidth) || image.naturalWidth,
    previewHeight: Number(image.dataset.bxHeight) || image.naturalHeight,
  }));
}

/**
 * Сведения для редактора о картинках из тегов описания. ID берём ровно как в теге — его же редактор
 * запишет обратно при сохранении. Файлы без картинки на странице (документы) не попадут — их тег
 * останется текстом.
 * @param {string} description Сырой BBCode описания
 * @param {object[]} pageImages Результат `collectPageImages`
 * @returns {object[]}
 */
export function buildDescriptionFiles(description, pageImages) {
  const fileIds = new Set([...String(description ?? '').matchAll(DISK_FILE_TAG_RE)].map((match) => match[1]));
  return [...fileIds]
    .map((fileId) => {
      const image = pageImages.find((pageImage) => fileId.toLowerCase() === `n${pageImage.objectId}`
        || fileId === pageImage.attachedObjectId);
      return image ? buildImageInfo({...image, serverFileId: fileId}) : null;
    })
    .filter(Boolean);
}

/**
 * Превью изображения для редактора: сам файл в data URL — картинка видна сразу, без запроса к Диску.
 * Читается до загрузки на Диск: формат, который браузер не показывает (HEIC, TIFF), иначе оставил бы
 * на Диске файл, который в текст уже не вставить.
 * @param {File} file
 * @returns {Promise<{src: string, width: number, height: number, previewWidth: number, previewHeight: number}|null>}
 *   `null`, если браузер не смог разобрать изображение или у него нет размеров
 */
export async function readImagePreview(file) {
  try {
    const src = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const image = new Image();
    image.src = src;
    await image.decode();

    const width = image.naturalWidth;
    const height = image.naturalHeight;
    // SVG без собственных размеров: высоту превью из нулевой ширины не посчитать
    if (!width || !height) return null;
    const previewWidth = Math.min(width, MAX_PREVIEW_WIDTH);
    return {src, width, height, previewWidth, previewHeight: Math.round(height * previewWidth / width)};
  } catch {
    return null;
  }
}

function buildUploadedImageInfo(preview, diskFile) {
  return buildImageInfo({...preview, serverFileId: `n${diskFile.ID}`, objectId: diskFile.ID, name: diskFile.NAME});
}

/**
 * Тег файла Диска для текста — строчными, как его пишет визуальный редактор Bitrix.
 * @param {string} serverFileId ID как в теге: `n123` или `456`
 * @returns {string}
 */
export function buildDiskFileTag(serverFileId) {
  return `[disk file id=${serverFileId}]`;
}

/**
 * Убирает из текста все теги указанного файла Диска (в любом регистре).
 * @param {string} text BBCode
 * @param {string} serverFileId ID как в теге: `n123` или `456`
 * @returns {string}
 */
export function removeDiskFileTag(text, serverFileId) {
  return String(text ?? '').replace(DISK_FILE_TAG_RE, (tag, fileId) => (
    fileId.toLowerCase() === String(serverFileId).toLowerCase() ? '' : tag
  ));
}

/**
 * Вложения редактора, как в форме Bitrix: файлы ложатся на Диск сразу (иначе тегу в тексте не на что
 * ссылаться), а к задаче прикрепляются одним вызовом `attachToTask` — когда задачу создают или
 * сохраняют текст. Вставленные из буфера картинки попадают в тот же список.
 * @param {import('./BitrixApi.js').default} api
 * @returns {{
 *   files: object[],
 *   imageInfos: import('vue').ComputedRef<object[]>,
 *   isUploading: import('vue').ComputedRef<boolean>,
 *   upload: (file: File) => Promise<object>,
 *   uploadImage: (file: File) => Promise<object>,
 *   remove: (item: object) => void,
 *   attachToTask: (taskId: string|number) => Promise<void>,
 * }}
 *   `files` — реактивный список `{key, diskFileId, name, size, isImage, info, isUploading}`;
 *   `imageInfos` — сведения о загруженных картинках для `files` редактора (передавайте их и там,
 *   где редактор пересоздаётся, иначе картинка станет тегом); `uploadImage` — для `uploadImage` редактора
 */
export function createEditorAttachments(api) {
  const files = reactive([]);

  async function upload(file) {
    files.push({
      key: crypto.randomUUID(),
      diskFileId: null,
      name: file.name,
      size: file.size,
      isImage: file.type.startsWith('image/'),
      info: null,
      isUploading: true,
      isAttached: false,
    });
    const item = files[files.length - 1];
    try {
      const preview = item.isImage ? await readImagePreview(file) : null;
      // Изображение, которое браузер не показывает, прикрепляется обычным файлом
      if (!preview) item.isImage = false;
      const diskFile = await api.uploadFileToDisk(file);
      item.diskFileId = String(diskFile.ID);
      item.name = diskFile.NAME ?? item.name;
      if (preview) item.info = buildUploadedImageInfo(preview, diskFile);
      item.isUploading = false;
      return item;
    } catch (error) {
      remove(item);
      throw error;
    }
  }

  async function uploadImage(file) {
    const item = await upload(file);
    if (!item.info) throw new Error('Браузер не может показать это изображение — оно прикреплено к задаче файлом.');
    return toRaw(item.info);
  }

  function remove(item) {
    const index = files.indexOf(item);
    if (index !== -1) files.splice(index, 1);
  }

  async function attachToTask(taskId) {
    for (const item of files.filter((file) => file.diskFileId && !file.isAttached)) {
      const {data} = await api.attachFileToTask(taskId, item.diskFileId);
      if (!data?.result?.attachmentId) throw new Error(data?.error_description || 'Bitrix не прикрепил файл к задаче');
      item.isAttached = true;
    }
  }

  return {
    files,
    imageInfos: computed(() => files.filter((file) => file.info).map((file) => toRaw(file.info))),
    isUploading: computed(() => files.some((file) => file.isUploading)),
    upload,
    uploadImage,
    remove,
    attachToTask,
  };
}
