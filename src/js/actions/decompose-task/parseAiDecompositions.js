import {hasAiEstimationV2Marker} from '../../aiEstimation.js';
import {
  AI_DECOMPOSITIONS_BLOCK_RE,
  AI_DECOMPOSITIONS_ITEM_RE,
  AI_ESTIMATION_V2_DECOMPOSITION_HEADING_RE,
  AI_ESTIMATION_V2_DECOMPOSITION_ITEM_RE,
  AI_ESTIMATION_V2_SECTION_END_RE,
  BBCODE_SIMPLE_FORMAT_TAG_RE,
} from '../../patterns.js';

// Возвращает null, если в описании нет блока [AI_DECOMPOSITIONS] или он пуст
export function parseAiDecompositions(description) {
  const blockMatch = description?.match(AI_DECOMPOSITIONS_BLOCK_RE);
  if (!blockMatch) return null;

  const items = blockMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const itemMatch = line.match(AI_DECOMPOSITIONS_ITEM_RE);
      const title = itemMatch?.[1]?.trim();
      return title ? {title, points: itemMatch[2] ? parseInt(itemMatch[2], 10) : null} : null;
    })
    .filter(Boolean);

  return items.length ? items : null;
}

// Раздел «Рекомендуемая декомпозиция» из комментария с ИИ-оценкой второй версии; null — раздела нет или он пуст
export function parseCommentAiDecompositions(text) {
  if (!hasAiEstimationV2Marker(text)) return null;

  const lines = text.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => AI_ESTIMATION_V2_DECOMPOSITION_HEADING_RE.test(line));
  if (headingIndex === -1) return null;

  const items = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (AI_ESTIMATION_V2_SECTION_END_RE.test(line)) break;
    // Строки с отступом — пояснения к пункту, а не отдельные подзадачи: регулярка требует маркер в начале строки
    const itemMatch = line.match(AI_ESTIMATION_V2_DECOMPOSITION_ITEM_RE);
    const title = itemMatch?.[1]?.replace(BBCODE_SIMPLE_FORMAT_TAG_RE, '').trim();
    const points = itemMatch?.[2] ?? itemMatch?.[3];
    if (title) items.push({title, points: points ? parseInt(points, 10) : null});
  }

  return items.length ? items : null;
}

// Готовая декомпозиция из самой свежей ИИ-оценки, где она есть: комментарии (вторая версия) новее описания (первая)
export function findLatestAiDecompositions(description, comments) {
  for (const comment of [...(comments ?? [])].reverse()) {
    const items = parseCommentAiDecompositions(comment.POST_MESSAGE);
    if (items) return items;
  }
  return parseAiDecompositions(description);
}
