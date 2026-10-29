import { getAiAttachmentKind, MAX_AI_ATTACHMENT_SIZE } from './PixelToolsApi.js';
import { showToast } from './toastHost/showToast.js';

/**
 * Вложения задачи, которые можно передать нейросети: сервис принимает к запросу одно изображение
 * и один документ, поэтому берутся первые подходящие по расширению и размеру.
 * @param {import('./BitrixApi.js').default} bitrixApi
 * @param {Array<string|number>} attachmentIds - ID вложений задачи (поле `UF_TASK_WEBDAV_FILES`).
 * @returns {Promise<{image: {name: string, url: string}|null, document: {name: string, url: string}|null}>}
 */
export async function findTaskAiAttachments(bitrixApi, attachmentIds) {
  const attachedObjects = await bitrixApi.getAttachedObjectsBatch(attachmentIds.map(String).filter(Boolean));
  const findFirst = (kind) => {
    const attachedObject = attachedObjects.find((candidate) => candidate.DOWNLOAD_URL
      && getAiAttachmentKind(candidate.NAME) === kind
      && Number(candidate.SIZE) <= MAX_AI_ATTACHMENT_SIZE);
    return attachedObject ? { name: attachedObject.NAME, url: attachedObject.DOWNLOAD_URL } : null;
  };
  return { image: findFirst('image'), document: findFirst('document') };
}

/**
 * Скачивает найденные `findTaskAiAttachments()` вложения для `PixelToolsApi.chat()`. Не скачалось —
 * запрос уходит без этого файла: пользователь получает предупреждение, а нейросеть — пометку `promptNote`
 * (передайте её в `systemMessage` метода `chat()`), чтобы не додумывала содержимое файла.
 * @param {{image: {name: string, url: string}|null, document: {name: string, url: string}|null}} attachments
 * @returns {Promise<{files: {image?: File, document?: File}, promptNote: string}>} Скачанные вложения и пометка
 * о нескачанных (пустая строка, если скачались все).
 */
export async function downloadTaskAiAttachments(attachments) {
  const results = await Promise.all(Object.entries(attachments)
    .filter(([, attachment]) => attachment)
    .map(async ([kind, attachment]) => {
      try {
        const url = attachment.url.startsWith('http') ? attachment.url : `${window.location.origin}${attachment.url}`;
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // Без type у File он пустой — тип скачанного blob сам не переносится, а изображение без него сервис отбросит
        const blob = await response.blob();
        return { kind, file: new File([blob], attachment.name, { type: blob.type }) };
      } catch (error) {
        console.warn(`[taskAiAttachments] не скачалось «${attachment.name}»`, error);
        return { kind, failedName: attachment.name };
      }
    }));

  const files = Object.fromEntries(results.filter((result) => result.file).map((result) => [result.kind, result.file]));
  const failedNames = results.filter((result) => result.failedName).map((result) => `«${result.failedName}»`);
  if (!failedNames.length) return { files, promptNote: '' };

  showToast({
    severity: 'warn',
    summary: 'Вложение не передано нейросети',
    detail: `Не удалось скачать ${failedNames.join(', ')} — запрос отправлен без ${failedNames.length > 1 ? 'них' : 'него'}.`,
    life: 10000,
  });
  return {
    files,
    promptNote: `К задаче приложены файлы ${failedNames.join(', ')}, но передать их тебе не удалось. Их содержимое тебе недоступно — не додумывай его.`,
  };
}
