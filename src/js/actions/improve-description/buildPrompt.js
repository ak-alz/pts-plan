import dayjs from 'dayjs';

import {minifyPrompt, TASK_STATUS_LABELS} from '../../utils.js';
import {MODE} from './variables.js';

// Что и как улучшать — смысловая часть стандартного промпта
const DEFAULT_INSTRUCTIONS = {
  [MODE.REWRITE]: `Ты — опытный аналитик и технический писатель. Перепиши описание (ТЗ) задачи из таск-трекера так, чтобы исполнитель с первого прочтения понял, что нужно сделать и зачем, без лишних уточнений.

Правила:
- Сохрани смысл и все факты исходного описания. Ничего не выдумывай: если информации не хватает, вынеси это в раздел «Открытые вопросы» в конце.
- Структурируй текст: цель и контекст, что нужно сделать (по пунктам), критерии приёмки, ссылки и материалы. Включай только разделы, для которых есть данные.
- Перенеси в описание договорённости и уточнения из комментариев — описание должно быть актуальным без чтения переписки.
- Пиши кратко и конкретно, без воды и канцелярита.`,
  [MODE.RECOMMEND]: `Ты — опытный аналитик. Оцени описание (ТЗ) задачи из таск-трекера глазами исполнителя, который впервые его читает.

Дай рекомендации: что сформулировано неясно, чего не хватает (цель, критерии приёмки, ограничения, ссылки, макеты), где описание противоречит комментариям или устарело. Затем сформулируй вопросы постановщику — конкретные, по одному на пункт, такие, без ответа на которые задачу нельзя сделать правильно.

Не переписывай само описание — только рекомендации и вопросы.`,
};

// Формат ответа: от него зависит, сможет ли виджет записать ответ в задачу
const OUTPUT_FORMAT = {
  [MODE.REWRITE]: `Формат ответа:
- Только текст нового описания, без вступления, пояснений и обрамления в \`\`\`.
- Разметка — BBCode Bitrix24: [B], [I], [U], [S], [LIST] и [LIST=1] с пунктами [*], [URL=адрес]текст[/URL], [QUOTE], [CODE], [TABLE]/[TR]/[TD]. Markdown не используй.
- Сохрани без изменений все ссылки, упоминания вида [USER=123]Имя[/USER] и вставленные файлы вида [DISK FILE ID=n123] — их нельзя удалять и переписывать.`,
  [MODE.RECOMMEND]: `Формат ответа — Markdown, два раздела:
## Рекомендации
(список)
## Вопросы постановщику
(нумерованный список)`,
};

function formatDate(value) {
  return value ? dayjs(value).format('DD.MM.YYYY HH:mm') : '';
}

function formatComment(comment, index) {
  const author = [comment.AUTHOR_NAME, comment.AUTHOR_LAST_NAME].filter(Boolean).join(' ') || '?';
  const date = comment.POST_DATE ? ` (${dayjs(comment.POST_DATE).format('DD.MM.YY HH:mm')})` : '';
  return `[${index + 1}] ${author}${date}:\n${(comment.POST_MESSAGE ?? '').trim()}`;
}

/**
 * Блок с данными задачи для промпта. Описание идёт раньше комментариев: при обрезке длинного
 * промпта страдает хвост, и пусть это будут старые комментарии, а не само ТЗ.
 * @param {object} context - Данные задачи (см. loadTaskContext в ImproveDescription.vue).
 * @param {Record<string, boolean>} include - Какие части передавать (ключи CONTEXT_PARTS).
 * @returns {string}
 */
export function buildTaskBlock(context, include) {
  const lines = [`Задача: ${context.title}`];

  if (include.status) {
    const status = TASK_STATUS_LABELS[context.status];
    if (status) lines.push(`Статус: ${status}`);
    if (context.stageName) lines.push(`Стадия: ${context.stageName}`);
  }

  if (include.participants) {
    if (context.creatorName) lines.push(`Постановщик: ${context.creatorName}`);
    if (context.responsibleName) lines.push(`Исполнитель: ${context.responsibleName}`);
  }

  if (include.dates) {
    if (context.createdDate) lines.push(`Создана: ${formatDate(context.createdDate)}`);
    if (context.deadline) lines.push(`Крайний срок: ${formatDate(context.deadline)}`);
    if (context.startDatePlan || context.endDatePlan) {
      lines.push(`План: ${formatDate(context.startDatePlan) || '—'} – ${formatDate(context.endDatePlan) || '—'}`);
    }
    lines.push(`Сегодня: ${dayjs().format('DD.MM.YYYY')}`);
  }

  const sections = [lines.join('\n')];
  sections.push(`Текущее описание (BBCode):\n${context.description?.trim() || '(описание пустое)'}`);

  if (include.parent && context.parent) {
    sections.push(`Родительская задача: ${context.parent.title}\nОписание родительской задачи:\n${context.parent.description?.trim() || '(пустое)'}`);
  }

  if (include.subtasks && context.subtasks?.length) {
    const subtaskLines = context.subtasks.map((subtask) => {
      const status = TASK_STATUS_LABELS[subtask.status];
      return `- ${subtask.title}${status ? ` (${status})` : ''}`;
    });
    sections.push(`Подзадачи:\n${subtaskLines.join('\n')}`);
  }

  if (include.comments && context.comments?.length) {
    sections.push(`Комментарии (${context.comments.length}):\n\n${context.comments.map(formatComment).join('\n\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Секция второго этапа режима рекомендаций: рекомендации первого этапа и ответы пользователя на них.
 * @param {string} recommendations - Ответ нейросети первого этапа.
 * @param {string} answers - Ответы и пояснения пользователя.
 * @returns {string} Пустая строка, если рекомендаций нет (обычный режим «сразу переписать»).
 */
export function buildRecommendationsSection(recommendations, answers) {
  if (!recommendations?.trim()) return '';

  return [
    `Ранее по этой задаче были даны рекомендации и вопросы постановщику:\n${recommendations.trim()}`,
    answers?.trim()
      ? `Ответы и пояснения пользователя — учти их в новом описании, они важнее исходного текста:\n${answers.trim()}`
      : 'Пользователь не ответил на вопросы — оставь их в разделе «Открытые вопросы».',
  ].join('\n\n');
}

/**
 * Стандартный промпт: инструкции, формат ответа, доп. контекст, для второго этапа — рекомендации
 * и ответы пользователя, и в конце данные задачи. Свои промпты — через библиотеку промптов
 * (см. promptSpec.js), этот остаётся вариантом «Стандартный».
 * @param {object} params
 * @param {string} params.mode - MODE.REWRITE или MODE.RECOMMEND.
 * @param {string} params.taskData - Результат buildTaskBlock.
 * @param {string} [params.extraContext] - Доп. контекст пользователя.
 * @param {string} [params.recommendationsSection] - Результат buildRecommendationsSection (только для REWRITE).
 * @returns {string}
 */
export function buildPrompt({mode, taskData, extraContext = '', recommendationsSection = ''}) {
  const parts = [DEFAULT_INSTRUCTIONS[mode], OUTPUT_FORMAT[mode]];

  if (extraContext.trim()) parts.push(`Дополнительный контекст от пользователя:\n${extraContext.trim()}`);
  if (mode === MODE.REWRITE && recommendationsSection.trim()) parts.push(recommendationsSection.trim());

  parts.push(`Данные задачи:\n\n${taskData}`);

  return minifyPrompt(parts.join('\n\n'));
}
