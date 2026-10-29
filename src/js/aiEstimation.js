import dayjs from 'dayjs';

import {
  AI_ESTIMATION_DATE_RE,
  AI_ESTIMATION_V1_BLOCK_RE,
  AI_ESTIMATION_V2_AGENT_TIME_RE,
  AI_ESTIMATION_V2_BUSINESS_QUESTIONS_HEADING_RE,
  AI_ESTIMATION_V2_CLARIFICATIONS_HEADING_RE,
  AI_ESTIMATION_V2_COMPLEXITY_RE,
  AI_ESTIMATION_V2_DATE_RE,
  AI_ESTIMATION_V2_HUMAN_TIME_RE,
  AI_ESTIMATION_V2_LIST_ITEM_RE,
  AI_ESTIMATION_V2_MARKER,
  AI_ESTIMATION_V2_POINTS_RE,
  AI_ESTIMATION_V2_QUALITY_RE,
  AI_ESTIMATION_V2_SECTION_END_RE,
  AI_ESTIMATION_V2_TECHNICAL_QUESTIONS_HEADING_RE,
  BBCODE_CODE_RE,
  BBCODE_QUOTE_RE,
} from './patterns.js';
import { isSystemComment } from './utils.js';

/**
 * Поля ИИ-оценки задачи, которые виджеты выводят в таблицах. Порядок — порядок вывода. `name` — название
 * поля, `label` — заголовок отдельной колонки. Ключи совпадают с полями объекта из `getAiEstimationValues()`.
 */
export const AI_ESTIMATION_COLUMNS = [
  { key: 'aiPoints', name: 'Баллы', label: 'ИИ: баллы' },
  { key: 'aiAgentHours', name: 'Время агента, ч', label: 'ИИ: время агента, ч' },
  { key: 'aiHumanHours', name: 'Время человека, ч', label: 'ИИ: время человека, ч' },
  { key: 'aiQuality', name: 'Качество постановки', label: 'ИИ: качество постановки' },
  { key: 'aiComplexity', name: 'Сложность анализа', label: 'ИИ: сложность анализа' },
  { key: 'aiBusinessQuestions', name: 'Вопросы постановщику', label: 'ИИ: вопросы постановщику' },
  { key: 'aiTechnicalQuestions', name: 'Технические вопросы', label: 'ИИ: технические вопросы' },
  { key: 'aiEstimatedAt', name: 'Дата оценки', label: 'ИИ: дата оценки' },
  { key: 'aiOutdated', name: 'Оценка устарела', label: 'ИИ: оценка устарела' },
];

export const AI_ESTIMATION_COLUMN_KEYS = AI_ESTIMATION_COLUMNS.map((column) => column.key);

/**
 * Пояснение к колонке «Оценка устарела» для подсказок рядом с выбором колонок.
 */
export const AI_ESTIMATION_OUTDATED_NOTE = '«ИИ: оценка устарела» — после оценки в задаче появились новые комментарии.';

function toNumberOrNull(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

function countOrNull(list) {
  return Array.isArray(list) ? list.length : null;
}

function parseHours(match) {
  if (!match) return null;
  const value = toNumberOrNull(match[1].replace(',', '.'));
  if (value == null) return null;
  return match[2].toLowerCase() === 'мин' ? Math.round((value / 60) * 10) / 10 : value;
}

function formatEstimatedAt(year, month, day, hours = '00', minutes = '00') {
  return `${year}-${month}-${day} ${hours.padStart(2, '0')}:${minutes}`;
}

// Пункты верхнего уровня в разделе под жирным заголовком; раздела нет — null
function countSectionItems(lines, headingPattern) {
  const headingIndex = lines.findIndex((line) => headingPattern.test(line));
  if (headingIndex === -1) return null;

  let count = 0;
  for (const line of lines.slice(headingIndex + 1)) {
    if (AI_ESTIMATION_V2_SECTION_END_RE.test(line)) break;
    if (AI_ESTIMATION_V2_LIST_ITEM_RE.test(line)) count++;
  }
  return count;
}

function parseEstimationState(block) {
  // JSON-state — последний [CODE] блока, но перед ним бывают и другие [CODE] с обычным текстом
  const codeBlocks = [...block.matchAll(BBCODE_CODE_RE)].map((match) => match[1]).reverse();
  for (const code of codeBlocks) {
    try {
      const state = JSON.parse(code);
      if (state && typeof state === 'object') return state;
    } catch {
      // не JSON — пробуем следующий блок
    }
  }
  return null;
}

/**
 * Разбирает ИИ-оценку первой версии (блок `⟦AI_ESTIMATION_V1⟧` в сыром описании задачи).
 * @param {string|null|undefined} description - Сырое (BBCode) описание задачи.
 * @returns {{version: 1, points: number|null, agentHours: number|null, humanHours: number|null, quality: string|null, complexity: string|null, businessQuestions: number|null, technicalQuestions: number|null, estimatedAt: string|null, lastSeenCommentId: number|null, authorId: null}|null}
 *   Поля оценки (`estimatedAt` — `YYYY-MM-DD HH:mm` по часам автора оценки), либо `null`, если оценки нет.
 */
export function parseAiEstimation(description) {
  const block = description?.match(AI_ESTIMATION_V1_BLOCK_RE)?.[1];
  if (!block) return null;

  const state = parseEstimationState(block);
  if (!state) return null;

  const complexityScore = toNumberOrNull(state.analysis_complexity?.score);
  const complexityLabel = state.analysis_complexity?.label;
  const dateMatch = block.match(AI_ESTIMATION_DATE_RE);
  const [, day, month, year, hours = '00', minutes = '00'] = dateMatch ?? [];

  return {
    version: 1,
    points: toNumberOrNull(state.points_total),
    agentHours: toNumberOrNull(state.machine_hours?.realistic),
    humanHours: toNumberOrNull(state.human_hours?.realistic),
    quality: state.quality || null,
    complexity: complexityScore == null ? null : `${complexityScore}/5${complexityLabel ? ` ${complexityLabel}` : ''}`,
    businessQuestions: countOrNull(state.business_questions),
    technicalQuestions: countOrNull(state.technical_questions),
    estimatedAt: dateMatch ? formatEstimatedAt(year, month, day, hours, minutes) : null,
    lastSeenCommentId: toNumberOrNull(state.last_seen_comment_id),
    authorId: null,
  };
}

/**
 * Есть ли в тексте комментария маркер ИИ-оценки второй версии. Маркер внутри цитаты не считается: процитировав
 * оценку, человек не делает свой комментарий новой оценкой.
 * @param {string|null|undefined} text - Текст комментария (BBCode).
 * @returns {boolean}
 */
export function hasAiEstimationV2Marker(text) {
  return !!text && text.replace(BBCODE_QUOTE_RE, '').includes(AI_ESTIMATION_V2_MARKER);
}

/**
 * Разбирает ИИ-оценку второй версии — комментарий с маркером `⟦AI_ESTIMATION_V2⟧`. JSON в нём нет,
 * значения берутся из текста: сводной строки, дат и разделов с вопросами.
 * @param {{ID: string, AUTHOR_ID: string, POST_MESSAGE: string}} comment - Комментарий задачи.
 * @returns {Object|null} Поля оценки в том же виде, что у `parseAiEstimation()`, либо `null`, если это не оценка.
 */
export function parseAiEstimationComment(comment) {
  const text = comment?.POST_MESSAGE ?? '';
  if (!hasAiEstimationV2Marker(text)) return null;

  const lines = text.split(/\r?\n/);
  const complexityMatch = text.match(AI_ESTIMATION_V2_COMPLEXITY_RE);
  const dateMatch = text.match(AI_ESTIMATION_V2_DATE_RE);
  const businessQuestions = countSectionItems(lines, AI_ESTIMATION_V2_BUSINESS_QUESTIONS_HEADING_RE);
  const clarifications = countSectionItems(lines, AI_ESTIMATION_V2_CLARIFICATIONS_HEADING_RE);
  const pointsMatch = text.match(AI_ESTIMATION_V2_POINTS_RE);

  return {
    version: 2,
    points: pointsMatch ? toNumberOrNull(pointsMatch[1].replace(',', '.')) : null,
    agentHours: parseHours(text.match(AI_ESTIMATION_V2_AGENT_TIME_RE)),
    humanHours: parseHours(text.match(AI_ESTIMATION_V2_HUMAN_TIME_RE)),
    quality: text.match(AI_ESTIMATION_V2_QUALITY_RE)?.[1] ?? null,
    complexity: complexityMatch ? `${complexityMatch[1]}/5${complexityMatch[2] ? ` ${complexityMatch[2]}` : ''}` : null,
    // «Уточним по ходу работы» — тоже вопросы постановщику, только не блокирующие начало работ
    businessQuestions: (businessQuestions ?? 0) + (clarifications ?? 0),
    technicalQuestions: countSectionItems(lines, AI_ESTIMATION_V2_TECHNICAL_QUESTIONS_HEADING_RE) ?? 0,
    estimatedAt: dateMatch ? formatEstimatedAt(...dateMatch.slice(1, 4), dateMatch[4], dateMatch[5]) : null,
    lastSeenCommentId: toNumberOrNull(comment.ID),
    authorId: comment.AUTHOR_ID ? String(comment.AUTHOR_ID) : null,
  };
}

/**
 * Последняя ИИ-оценка задачи: из последнего комментария с оценкой второй версии, а если такого нет —
 * первая версия из описания.
 * @param {string|null|undefined} description - Сырое (BBCode) описание задачи.
 * @param {Object[]|null|undefined} comments - Комментарии задачи по возрастанию даты.
 * @returns {Object|null} Поля оценки (см. `parseAiEstimation()`), либо `null`, если оценки нет.
 */
export function findLatestAiEstimation(description, comments) {
  for (const comment of [...(comments ?? [])].reverse()) {
    const estimation = parseAiEstimationComment(comment);
    if (estimation) return estimation;
  }
  return parseAiEstimation(description);
}

/**
 * Устарела ли оценка: после последнего учтённого ею комментария в задаче появились новые — не системные
 * и, для оценки из комментария, не от её автора (следом за оценкой он обычно сам пишет вопросы постановщику).
 * @param {Object|null} estimation - Результат `parseAiEstimation()` или `findLatestAiEstimation()`.
 * @param {Object[]|null|undefined} comments - Комментарии задачи (все или только новее учтённого), поля `ID` и `POST_MESSAGE`.
 * @returns {boolean|null} `null`, если оценки нет, комментарии не загружены или неизвестно, какой комментарий учтён.
 */
export function isAiEstimationOutdated(estimation, comments) {
  // 0 — оценку делали, когда комментариев ещё не было: тогда считается любой новый
  if (estimation?.lastSeenCommentId == null || !comments) return null;
  return comments.some((comment) => Number(comment.ID) > estimation.lastSeenCommentId
    && String(comment.AUTHOR_ID) !== estimation.authorId
    && !isSystemComment(comment));
}

/**
 * Значения колонок ИИ-оценки по ключам из `AI_ESTIMATION_COLUMNS`. Без оценки все значения `null`.
 * @param {Object|null} estimation - Результат `parseAiEstimation()` или `findLatestAiEstimation()`.
 * @param {Object[]|null} [comments] - Комментарии задачи для «Оценка устарела»; не переданы — значение `null`.
 * @returns {Record<string, number|string|boolean|null>}
 */
export function getAiEstimationValues(estimation, comments = null) {
  return {
    aiPoints: estimation?.points ?? null,
    aiAgentHours: estimation?.agentHours ?? null,
    aiHumanHours: estimation?.humanHours ?? null,
    aiQuality: estimation?.quality ?? null,
    aiComplexity: estimation?.complexity ?? null,
    aiBusinessQuestions: estimation?.businessQuestions ?? null,
    aiTechnicalQuestions: estimation?.technicalQuestions ?? null,
    aiEstimatedAt: estimation?.estimatedAt ?? null,
    aiOutdated: isAiEstimationOutdated(estimation, comments),
  };
}

/**
 * Значение колонки ИИ-оценки для показа и выгрузки: дата — `DD.MM.YYYY`, признак устаревания — «да»/«нет»,
 * числа остаются числами.
 * @param {string} key - Ключ колонки из `AI_ESTIMATION_COLUMNS`.
 * @param {number|string|boolean|null} value - Значение из `getAiEstimationValues()`.
 * @returns {number|string|null} `null`, если значения нет.
 */
export function formatAiEstimationValue(key, value) {
  if (value == null) return null;
  if (key === 'aiEstimatedAt') return dayjs(value).format('DD.MM.YYYY');
  if (key === 'aiOutdated') return value ? 'да' : 'нет';
  return value;
}
