import dayjs from 'dayjs';

import {minifyPrompt, pluralize, TASK_STATUS_LABELS} from '../../utils.js';
import {MODE, SPEC_BUG_CRITERIA, SPEC_CRITERIA} from './variables.js';

const SPEC_CRITERIA_PROMPT = [
  'Что должно быть в хорошем ТЗ на доработку:',
  ...SPEC_CRITERIA.map((criterion, index) => {
    const condition = criterion.when ? ` (если задача касается: ${criterion.when})` : '';
    const description = [criterion.text, ...(criterion.points ?? [])].filter(Boolean).join(' ');
    return `${index + 1}. ${criterion.title}${condition}: ${description}`;
  }),
  `Для бага: ${SPEC_BUG_CRITERIA}`,
].join('\n');

// Пароли и личные данные из задачи не должны расходиться дальше — ни в новое описание, ни в рекомендации
const SECRETS_RULE = '- Пароли, токены, ключи, логины и доступы, личные данные (паспорт, телефоны, почты клиентов, зарплаты конкретных людей) в ответ не переноси. Доступ в описании замени на «доступ — по запросу у постановщика в личных сообщениях».';

// Порядок разделов нового описания — по критериям, в языке постановщика
const REWRITE_SECTIONS = 'Разделы для доработки: «Зачем», «Что входит / не входит», «Где и для кого», «Сейчас → нужно», «Что сделать» (по пунктам), «Правила расчёта и особые случаи», «Права», «Что ещё затронет», «Запуск и прошлые данные», «Как выглядит и тексты», «Как проверить», «Материалы». Для бага: «Где воспроизводится», «Шаги», «Фактически → ожидаемо», «Скриншоты и примеры», «Повторяется ли».';

// Как поступать с недостающими данными: раздел вопросов в конце или пометки на месте пропуска —
// второе превращает описание в шаблон, который постановщик дописывает (как в быстром создании задачи)
const GAP_RULES = {
  questions: `- Сохрани смысл и все факты исходного описания. Ничего не выдумывай: если информации не хватает, вынеси это в раздел «Открытые вопросы» в конце — не больше 5 самых важных вопросов, по убыванию важности. Важнее всего то, без чего нельзя начинать: правила расчёта, права, объём, затем особые случаи и старт.
- ${REWRITE_SECTIONS} Включай только разделы, для которых есть данные.`,
  inline: `- Сохрани смысл и все факты исходного описания. Если в описании уже есть шаблон (разделы, заголовки, пункты) — сохрани его структуру и порядок разделов и заполни их.
- ${REWRITE_SECTIONS} Разделы «Что входит / не входит», «Где и для кого», «Сейчас → нужно», «Что сделать», «Как проверить» включай всегда, остальные — если задача их касается, даже когда данных для них нет.
- Ничего не выдумывай. Конкретику, которой нет в данных (ссылки, значения, правила, сроки, макеты), не сочиняй — оставь на её месте пометку [I](уточнить: что именно)[/I], постановщик допишет сам. Отдельный раздел вопросов не нужен.`,
};

function buildRewriteInstructions(inlineGaps) {
  return `Ты — опытный аналитик и технический писатель. Перепиши описание (ТЗ) задачи из таск-трекера так, чтобы исполнитель с первого прочтения понял, что нужно сделать и зачем, без лишних уточнений.

${SPEC_CRITERIA_PROMPT}

Правила:
${inlineGaps ? GAP_RULES.inline : GAP_RULES.questions}
- Перенеси в описание договорённости и уточнения из комментариев — описание должно быть актуальным без чтения переписки. Если комментарии противоречат описанию, бери последнее решение.
- Родительские задачи и подзадачи (с их комментариями) — контекст: по ним понимай цель и границы этой задачи, но не переноси их содержимое в описание целиком. Суть, на которую опирается задача, перескажи, а не давай только ссылкой.
- Пример в цифрах переноси как есть, не пересчитывай и не придумывай свой.
${SECRETS_RULE}
- Пиши кратко и конкретно, без воды и канцелярита.`;
}

// Что и как улучшать — смысловая часть стандартного промпта
const DEFAULT_INSTRUCTIONS = {
  [MODE.REWRITE]: buildRewriteInstructions,
  [MODE.RECOMMEND]: () => `Ты — опытный аналитик. Оцени описание (ТЗ) задачи из таск-трекера глазами исполнителя, который впервые его читает. Постановщик обычно менеджер, а не программист.

${SPEC_CRITERIA_PROMPT}

Сверь описание с этим списком. Дай рекомендации: каких пунктов не хватает, что сформулировано неясно, где описание противоречит комментариям, макету или само себе, что решено в комментариях, но не перенесено в описание. Затем сформулируй вопросы постановщику — такие, без ответа на которые задачу нельзя сделать правильно.

Правила:
- Не больше 5 рекомендаций и не больше 5 вопросов, по убыванию важности. Чаще всего работу блокируют правила расчёта, права и объём, затем особые случаи, старт и прошлые данные, влияние на другие отчёты. Мелочи (стиль, оформление, опечатки, сортировку, подписи) пропускай. Если важного меньше — дай меньше, не добирай до пяти.
- Не спрашивай то, на что уже есть ответ в описании или комментариях.
- Вопрос — языком постановщика: через страницу, кнопку, письмо, цифру в отчёте, без терминов из кода. Пример на понятном случае, если правило абстрактное. Варианты ответа и что из каждого выйдет, последним вариантом — «другое — опишите». Ответ должен одной фразой ложиться в описание.
- Каждый пункт — одно-два предложения. Не дублируй: если вопрос закрывает рекомендацию, оставь только вопрос.
- Если в задаче есть пароли, токены, доступы или личные данные — первая рекомендация: убрать их из задачи и сменить пароль; передавать доступы только в личных сообщениях. Сами значения не повторяй.
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

// Комментарии от новых к старым: последние решения важнее, а при нехватке места выкидываются старые
function newestFirst(comments, excludedCommentIds) {
  return comments.filter((comment) => !excludedCommentIds.has(comment.ID)).reverse();
}

// Комментарии по задачам: заголовок задачи, под ним её комментарии; задачи без комментариев пропускаем
function formatCommentsByTask(tasks, commentsByTaskId, excludedCommentIds) {
  return tasks
    .map((task) => ({ task, comments: newestFirst(commentsByTaskId[task.id] ?? [], excludedCommentIds) }))
    .filter(({ comments }) => comments.length)
    .map(({ task, comments }) => `«${task.title}»:\n\n${comments.map(formatComment).join('\n\n')}`)
    .join('\n\n');
}

/**
 * Блок с данными задачи для промпта. Описание идёт раньше комментариев, комментарии — от новых к старым:
 * если промпт всё же обрезается с хвоста, страдают старые комментарии, а не само ТЗ.
 * @param {object} context - Данные задачи (см. loadTaskContext в ImproveDescription.vue).
 * @param {Record<string, boolean>} include - Какие части передавать (ключи CONTEXT_PARTS).
 * @param {Set<string>} [excludedCommentIds] - Комментарии, которые не влезли в лимит нейросети.
 * @returns {string}
 */
export function buildTaskBlock(context, include, excludedCommentIds = new Set()) {
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
    const comments = newestFirst(context.comments, excludedCommentIds);
    const omittedCount = context.comments.length - comments.length;
    const omittedNote = omittedCount
      ? `\n\nЕщё ${omittedCount} ${pluralize(omittedCount, ['более старый комментарий не поместился', 'более старых комментария не поместились', 'более старых комментариев не поместились'])} в запрос.`
      : '';
    sections.push(`Комментарии (${comments.length}, от новых к старым):\n\n${comments.map(formatComment).join('\n\n')}${omittedNote}`);
  }

  if (include.parentComments && context.parentComments && context.parents?.length) {
    const blocks = formatCommentsByTask(context.parents, context.parentComments, excludedCommentIds);
    if (blocks) sections.push(`Комментарии родительских задач (от новых к старым):\n\n${blocks}`);
  }

  if (include.subtaskComments && context.subtaskComments && context.subtasks?.length) {
    const blocks = formatCommentsByTask(context.subtasks, context.subtaskComments, excludedCommentIds);
    if (blocks) sections.push(`Комментарии подзадач (от новых к старым):\n\n${blocks}`);
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
