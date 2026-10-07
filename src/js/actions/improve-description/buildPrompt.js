import dayjs from 'dayjs';

import {minifyPrompt, TASK_STATUS_LABELS} from '../../utils.js';
import {MODE} from './variables.js';

// Как поступать с недостающими данными: раздел вопросов в конце или пометки на месте пропуска —
// второе превращает описание в шаблон, который постановщик дописывает (как в быстром создании задачи)
const GAP_RULES = {
  questions: `- Сохрани смысл и все факты исходного описания. Ничего не выдумывай: если информации не хватает, вынеси это в раздел «Открытые вопросы» в конце — не больше 5 самых важных вопросов, по убыванию важности.
- Структурируй текст: цель и контекст, что нужно сделать (по пунктам), критерии приёмки, ссылки и материалы. Включай только разделы, для которых есть данные.`,
  inline: `- Сохрани смысл и все факты исходного описания. Если в описании уже есть шаблон (разделы, заголовки, пункты) — сохрани его структуру и порядок разделов и заполни их.
- Структурируй текст: цель и контекст, что нужно сделать (по пунктам), критерии приёмки, ссылки и материалы. Нужный раздел включай, даже если данных для него нет.
- Ничего не выдумывай. Конкретику, которой нет в данных (ссылки, значения, сроки, доступы, макеты), не сочиняй — оставь на её месте пометку [I](уточнить: что именно)[/I], постановщик допишет сам. Отдельный раздел вопросов не нужен.`,
};

function buildRewriteInstructions(inlineGaps) {
  return `Ты — опытный аналитик и технический писатель. Перепиши описание (ТЗ) задачи из таск-трекера так, чтобы исполнитель с первого прочтения понял, что нужно сделать и зачем, без лишних уточнений.

Правила:
${inlineGaps ? GAP_RULES.inline : GAP_RULES.questions}
- Перенеси в описание договорённости и уточнения из комментариев — описание должно быть актуальным без чтения переписки.
- Родительские задачи и подзадачи (с их комментариями) — контекст: по ним понимай цель и границы этой задачи, но не переноси их содержимое в описание целиком.
- Пиши кратко и конкретно, без воды и канцелярита.`;
}

// Что и как улучшать — смысловая часть стандартного промпта
const DEFAULT_INSTRUCTIONS = {
  [MODE.REWRITE]: buildRewriteInstructions,
  [MODE.RECOMMEND]: () => `Ты — опытный аналитик. Оцени описание (ТЗ) задачи из таск-трекера глазами исполнителя, который впервые его читает.

Дай рекомендации: что сформулировано неясно, чего не хватает (цель, критерии приёмки, ограничения, ссылки, макеты), где описание противоречит комментариям или устарело. Затем сформулируй вопросы постановщику — конкретные, такие, без ответа на которые задачу нельзя сделать правильно.

Правила:
- Не больше 5 рекомендаций и не больше 5 вопросов. Выбери самые важные — то, что сильнее всего мешает исполнителю сделать задачу правильно, — и расположи по убыванию важности. Мелочи (стиль, оформление, опечатки) пропускай. Если важного меньше — дай меньше, не добирай до пяти.
- Каждый пункт — одно-два предложения. Не дублируй: если вопрос закрывает рекомендацию, оставь только вопрос.
- Не переписывай само описание — только рекомендации и вопросы.`,
};

// Формат ответа: от него зависит, сможет ли виджет записать ответ в задачу
const OUTPUT_FORMAT = {
  [MODE.REWRITE]: `Формат ответа:
- Только текст нового описания, без вступления, пояснений и обрамления в \`\`\`.
- Разметка — BBCode Bitrix24: [B], [I], [U], [S], [LIST] и [LIST=1] с пунктами [*], [URL=адрес]текст[/URL], [QUOTE], [CODE], [TABLE]/[TR]/[TD]. Markdown не используй.
- Сохрани без изменений все ссылки, упоминания вида [USER=123]Имя[/USER] и вставленные файлы вида [DISK FILE ID=n123] — их нельзя удалять и переписывать.`,
  [MODE.RECOMMEND]: `Формат ответа — Markdown, два раздела, без вступления и выводов:
## Рекомендации
(список, до 5 пунктов)
## Вопросы постановщику
(нумерованный список, до 5 пунктов)`,
};

function formatDate(value) {
  return value ? dayjs(value).format('DD.MM.YYYY HH:mm') : '';
}

function formatComment(comment, index) {
  const author = [comment.AUTHOR_NAME, comment.AUTHOR_LAST_NAME].filter(Boolean).join(' ') || '?';
  const date = comment.POST_DATE ? ` (${dayjs(comment.POST_DATE).format('DD.MM.YY HH:mm')})` : '';
  return `[${index + 1}] ${author}${date}:\n${(comment.POST_MESSAGE ?? '').trim()}`;
}

// Пункты с PARENT_ID 0 — сами чек-листы, остальные висят под ними (и друг под другом)
function formatChecklist(items) {
  const childrenByParentId = new Map();
  items.forEach((item) => {
    const parentKey = String(item.PARENT_ID ?? 0);
    if (!childrenByParentId.has(parentKey)) childrenByParentId.set(parentKey, []);
    childrenByParentId.get(parentKey).push(item);
  });

  const formatLevel = (parentId, depth) => (childrenByParentId.get(String(parentId)) ?? []).flatMap((item) => {
    const line = depth === 0
      ? `${item.TITLE}:`
      : `${'  '.repeat(depth - 1)}- [${item.IS_COMPLETE === 'Y' ? 'x' : ' '}] ${item.TITLE}`;
    return [line, ...formatLevel(item.ID, depth + 1)];
  });
  return formatLevel(0, 0).join('\n');
}

// Комментарии по задачам: заголовок задачи, под ним её комментарии; задачи без комментариев пропускаем
function formatCommentsByTask(tasks, commentsByTaskId) {
  return tasks
    .filter((task) => commentsByTaskId[task.id]?.length)
    .map((task) => `«${task.title}»:\n\n${commentsByTaskId[task.id].map(formatComment).join('\n\n')}`)
    .join('\n\n');
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

  if (include.checklist && context.checklist?.length) {
    sections.push(`Чек-лист:\n${formatChecklist(context.checklist)}`);
  }

  if (include.parent && context.parents?.length) {
    const parentBlocks = context.parents.map((parent, index) => {
      const status = TASK_STATUS_LABELS[parent.status];
      return `${index + 1}. ${parent.title}${status ? ` (${status})` : ''}\nОписание:\n${parent.description?.trim() || '(пустое)'}`;
    });
    sections.push(`Родительские задачи — от корневой к прямому родителю:\n\n${parentBlocks.join('\n\n')}`);
  }

  if (include.subtasks && context.subtasks?.length) {
    const subtaskLines = context.subtasks.map((subtask) => {
      const status = TASK_STATUS_LABELS[subtask.status];
      return `${'  '.repeat(subtask.depth)}- ${subtask.title}${status ? ` (${status})` : ''}`;
    });
    sections.push(`Подзадачи:\n${subtaskLines.join('\n')}`);
  }

  // Комментарии — в конце и от важных к второстепенным: длинный промпт обрезается с хвоста
  if (include.comments && context.comments?.length) {
    sections.push(`Комментарии (${context.comments.length}):\n\n${context.comments.map(formatComment).join('\n\n')}`);
  }

  if (include.parentComments && context.parentComments && context.parents?.length) {
    const blocks = formatCommentsByTask(context.parents, context.parentComments);
    if (blocks) sections.push(`Комментарии родительских задач:\n\n${blocks}`);
  }

  if (include.subtaskComments && context.subtaskComments && context.subtasks?.length) {
    const blocks = formatCommentsByTask(context.subtasks, context.subtaskComments);
    if (blocks) sections.push(`Комментарии подзадач:\n\n${blocks}`);
  }

  return sections.join('\n\n');
}

/**
 * Секция второго этапа режима рекомендаций: рекомендации первого этапа и ответы постановщика на них.
 * @param {string} recommendations - Ответ нейросети первого этапа.
 * @param {string} answers - Ответы и пояснения постановщика.
 * @param {object} [options]
 * @param {boolean} [options.inlineGaps] - Неотвеченное — пометками «уточнить» в тексте, а не разделом вопросов.
 * @returns {string} Пустая строка, если рекомендаций нет (обычный режим «сразу переписать»).
 */
export function buildRecommendationsSection(recommendations, answers, {inlineGaps = false} = {}) {
  if (!recommendations?.trim()) return '';

  const unansweredRule = inlineGaps
    ? 'оставь пометки «уточнить» там, где ответов не хватает'
    : 'оставь неотвеченные вопросы в разделе «Открытые вопросы»';
  return [
    `Ранее по этой задаче были даны рекомендации и вопросы постановщику:\n${recommendations.trim()}`,
    answers?.trim()
      ? `Ответы и пояснения постановщика — учти их в новом описании, они важнее исходного текста; ${unansweredRule}:\n${answers.trim()}`
      : `Постановщик не ответил на вопросы — ${unansweredRule}.`,
  ].join('\n\n');
}

/**
 * Стандартный промпт: инструкции, формат ответа, доп. контекст, для второго этапа — рекомендации
 * и ответы постановщика, и в конце данные задачи. Свои промпты — через библиотеку промптов
 * (см. promptSpec.js), этот остаётся вариантом «Стандартный».
 * @param {object} params
 * @param {string} params.mode - MODE.REWRITE или MODE.RECOMMEND.
 * @param {string} params.taskData - Результат buildTaskBlock.
 * @param {string} [params.extraContext] - Доп. контекст постановщика.
 * @param {string} [params.recommendationsSection] - Результат buildRecommendationsSection (только для REWRITE).
 * @param {boolean} [params.inlineGaps] - Пропуски — пометками «уточнить» в тексте (только для REWRITE).
 * @returns {string}
 */
export function buildPrompt({mode, taskData, extraContext = '', recommendationsSection = '', inlineGaps = false}) {
  const parts = [DEFAULT_INSTRUCTIONS[mode](inlineGaps), OUTPUT_FORMAT[mode]];

  if (extraContext.trim()) parts.push(`Дополнительный контекст от постановщика:\n${extraContext.trim()}`);
  if (mode === MODE.REWRITE && recommendationsSection.trim()) parts.push(recommendationsSection.trim());

  parts.push(`Данные задачи:\n\n${taskData}`);

  return minifyPrompt(parts.join('\n\n'));
}
