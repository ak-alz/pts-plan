import { createWidgetCache } from '../../widgetCache.js';

/**
 * Кэш разобранных итогов спринтов: комментарии задачи-сводки читаются целиком, у команды с годовой
 * историей это заметная пауза со скелетонами при каждом открытии. Общая механика —
 * в `src/js/widgetCache.js`. Срок больше, чем у виджетов про текущее состояние канбана: итоги
 * прошедших спринтов не меняются, новый появляется примерно раз в неделю.
 */
const cache = createWidgetCache({
  keyPrefix: 'scrum-summary-cache-',
  version: 1,
  maxAgeDays: 30,
});

export const {load: loadCache, save: saveCache, clear: clearCache, getSizeBytes: getCacheSizeBytes} = cache;

/**
 * Подпись настроек: данные целиком приходят из комментариев одной задачи, всё остальное (период,
 * порог баллов, набор исполнителей) — фильтры поверх них, кэш от них не зависит.
 * @param {Object|null} settings - Настройки виджета.
 * @returns {string} Подпись для сравнения с сохранённой.
 */
export function buildCacheSignature(settings) {
  return String(settings?.taskId ?? '');
}
