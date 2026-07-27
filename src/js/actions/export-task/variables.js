export const DEFAULT_ARCHIVE_NAME_TEMPLATE = 'task-{task_id}.zip';

export const ARCHIVE_NAME_SLUG_PLACEHOLDER = '{task_slug}';

const CYRILLIC_RE = /[а-яё]/i;
const POINTS_SEGMENT_RE = /^\d+([.,]\d+)?\+?$/;

/**
 * Вычленяет из названия задачи собственно её текст — то, что идёт в slug и на перевод.
 * Название обрамлено служебными частями через `|`: спереди — префикс проекта латиницей,
 * сзади — оценка. Отбрасывается только то, что действительно похоже на них, поэтому
 * «General | Добавить события | 8+», «General | Добавить события», «Добавить события | 8»
 * и «Добавить события» дают одинаковый результат.
 * @param {string} taskTitle Название задачи
 * @returns {string} Текст названия без префикса проекта и оценки
 */
export function getTaskTitleText(taskTitle) {
  const segments = (taskTitle || '').split('|').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length < 2) return segments[0] ?? '';

  const firstTextIndex = CYRILLIC_RE.test(segments[0]) ? 0 : 1;
  const afterTextIndex = POINTS_SEGMENT_RE.test(segments.at(-1)) ? segments.length - 1 : segments.length;
  const textSegments = segments.slice(firstTextIndex, afterTextIndex);

  return (textSegments.length ? textSegments : segments).join(' ');
}

/**
 * Подставляет номер задачи и slug её названия в шаблон названия архива.
 * @param {string} template Шаблон с плейсхолдерами {task_id} и {task_slug}
 * @param {string} taskId Номер задачи
 * @param {string} taskSlug Slug названия задачи (может быть пустым)
 * @returns {string} Название архива без гарантии расширения
 */
export function renderArchiveName(template, taskId, taskSlug = '') {
  return (template || DEFAULT_ARCHIVE_NAME_TEMPLATE)
    .replaceAll('{task_id}', taskId)
    .replaceAll(ARCHIVE_NAME_SLUG_PLACEHOLDER, taskSlug)
    // Пустой slug оставляет за собой висящий разделитель («task-12345-.zip»)
    .replace(/[-_]+(?=\.[^.]*$|$)/, '')
    .trim();
}

/**
 * Добавляет расширение .zip, если пользователь его не указал.
 * @param {string} name Название архива
 * @returns {string} Название архива с расширением .zip
 */
export function withZipExtension(name) {
  return name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`;
}
