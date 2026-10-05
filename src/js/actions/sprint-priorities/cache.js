import { createWidgetCache } from '../../widgetCache.js';

/**
 * Кэш последнего показанного состояния виджета: без него каждое открытие несколько секунд держит
 * пустую таблицу, пока грузятся Google Таблица, данные задач и баллы команды. Общая механика —
 * в `src/js/widgetCache.js`.
 */
const cache = createWidgetCache({
  keyPrefix: 'sprint-priorities-cache-',
  // 2 — у строк всегда есть исполнитель с ID (фильтр и распределение приоритетов), даже при скрытой колонке
  version: 2,
  maxAgeDays: 7,
  // Список задач команды — самая тяжёлая часть и нужен только для окна со списком задач исполнителя
  trimPayload: (payload) => ({...payload, teamTasksRaw: []}),
});

export const {load: loadCache, save: saveCache, clear: clearCache, getSizeBytes: getCacheSizeBytes} = cache;

/**
 * Подпись настроек, от которых зависит состав кэшированных данных: другая таблица, другой набор
 * колонок или другие настройки баллов команды — и сохранённые строки уже неполные или не те.
 * @param {Object|null} settings - Настройки виджета.
 * @param {string[]} visibleColumnKeys - Ключи видимых колонок таблицы.
 * @returns {string} Подпись для сравнения с сохранённой.
 */
export function buildCacheSignature(settings, visibleColumnKeys) {
  return JSON.stringify([
    settings?.sheetUrl ?? '',
    settings?.hasHeaders ?? true,
    settings?.autoDetectColumn ?? true,
    settings?.taskColumnIndex ?? 1,
    [...visibleColumnKeys].sort(),
    settings?.showTeamPoints ?? true,
    [...(settings?.teamStages ?? [])].sort(),
    [...(settings?.teamUsers ?? [])].sort(),
  ]);
}
