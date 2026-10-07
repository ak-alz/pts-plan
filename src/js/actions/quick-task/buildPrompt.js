import {minifyPrompt} from '../../utils.js';

const INSTRUCTIONS = `Ты — опытный аналитик и технический писатель. Составь описание (ТЗ) новой задачи для таск-трекера по её названию, черновику описания и контексту — так, чтобы исполнитель понял, что нужно сделать и зачем.

Правила:
- Если в текущем описании уже есть шаблон (разделы, заголовки, пункты) — сохрани его структуру и порядок разделов и заполни их. Если там черновик или заметки — разверни их в полноценное описание, сохранив все факты.
- Если описание пустое — используй структуру: цель и контекст, что нужно сделать (по пунктам), критерии приёмки, ссылки и материалы. Включай только уместные разделы.
- Ничего не выдумывай. Конкретику, которой нет в данных (ссылки, значения, сроки, доступы, макеты), не сочиняй — оставь на её месте пометку [I](уточнить: что именно)[/I], постановщик допишет сам.
- Пиши кратко и конкретно, без воды и канцелярита.`;

const OUTPUT_FORMAT = `Формат ответа:
- Только текст описания, без вступления, пояснений и обрамления в \`\`\`.
- Разметка — BBCode Bitrix24: [B], [I], [U], [S], [LIST] и [LIST=1] с пунктами [*], [URL=адрес]текст[/URL], [QUOTE], [CODE], [TABLE]/[TR]/[TD]. Markdown не используй.
- Сохрани без изменений все ссылки и упоминания вида [USER=123]Имя[/USER] из исходного текста.`;

/**
 * Блок с данными создаваемой задачи для промпта.
 * @param {object} params
 * @param {string} params.title
 * @param {string} [params.description] - Текущий текст описания: черновик, шаблон или пусто.
 * @param {string} [params.projectName]
 * @param {string} [params.stageName]
 * @param {string} [params.responsibleName]
 * @returns {string}
 */
export function buildTaskBlock({title, description, projectName, stageName, responsibleName}) {
  const lines = [`Название задачи: ${title}`];
  if (projectName) lines.push(`Проект: ${projectName}`);
  if (stageName) lines.push(`Стадия: ${stageName}`);
  if (responsibleName) lines.push(`Исполнитель: ${responsibleName}`);

  return [
    lines.join('\n'),
    `Текущее описание (BBCode):\n${description?.trim() || '(пусто)'}`,
  ].join('\n\n');
}

/**
 * Стандартный промпт генерации описания. Свои промпты — через библиотеку (см. promptSpec.js).
 * @param {object} params
 * @param {string} params.taskData - Результат buildTaskBlock.
 * @param {string} [params.extraContext] - Доп. контекст постановщика.
 * @returns {string}
 */
export function buildPrompt({taskData, extraContext = ''}) {
  const parts = [INSTRUCTIONS, OUTPUT_FORMAT];
  if (extraContext.trim()) parts.push(`Дополнительный контекст от постановщика:\n${extraContext.trim()}`);
  parts.push(`Данные задачи:\n\n${taskData}`);

  return minifyPrompt(parts.join('\n\n'));
}
