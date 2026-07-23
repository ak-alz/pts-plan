import {AI_DECOMPOSITIONS_BLOCK_RE, AI_DECOMPOSITIONS_ITEM_RE} from '../../patterns.js';

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
