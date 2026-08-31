import dayjs from 'dayjs';

/**
 * Кэш «показать прошлый результат сразу» для виджетов канбана. Виджет рисует сохранённое состояние
 * мгновенно, а свежие данные загружает следом в обычном порядке и заменяет им кэш — поэтому
 * инвалидировать кэш по событиям не нужно: на экране он живёт ровно до конца обычной загрузки.
 *
 * Отбрасывается он только тогда, когда показывать его вредно или бессмысленно: сменилась версия
 * формата, сменилась подпись (настройки, от которых зависит сам состав данных) или он слишком стар,
 * чтобы мелькнуть на экране в качестве правдоподобного.
 *
 * Кэш дневных агрегатов в `task-dynamics/cache.js` живёт отдельно: там кэш не ускоряет отрисовку, а
 * экономит запросы, и у него своя логика недостающих дней и вытеснения по возрасту.
 *
 * @param {Object} config
 * @param {string} config.keyPrefix - Префикс ключа chrome.storage.local, к нему добавляется groupId.
 * @param {number} config.version - Версия структуры: кэш другой версии отбрасывается целиком.
 * @param {number} config.maxAgeDays - Возраст, после которого кэш не показывается.
 * @param {number} [config.maxBytes] - Предел объёма на группу.
 * @param {Function} [config.trimPayload] - Как урезать данные, если они не влезли в предел.
 * @returns {{load: Function, save: Function, clear: Function, getSizeBytes: Function}}
 */
export function createWidgetCache({keyPrefix, version, maxAgeDays, maxBytes = 2 * 1024 * 1024, trimPayload = null}) {
  const getStorageKey = (groupId) => `${keyPrefix}${groupId}`;
  const measureBytes = (json) => new TextEncoder().encode(json).length;

  /**
   * Читает кэш группы, годный к показу прямо сейчас.
   * @param {string} groupId
   * @param {string} signature - Подпись текущих настроек.
   * @returns {Promise<Object|null>} Сохранённые данные с полем savedAt или null.
   */
  async function load(groupId, signature) {
    const storageKey = getStorageKey(groupId);
    const stored = await chrome.storage.local.get([storageKey]);
    const cache = stored[storageKey];

    if (!cache || cache.version !== version) return null;
    if (cache.signature !== signature) return null;
    if (!cache.savedAt || dayjs().diff(dayjs(cache.savedAt), 'day') >= maxAgeDays) return null;

    return cache;
  }

  /**
   * Сохраняет состояние виджета. Данные прогоняются через JSON: пришли они из ref/reactive, а
   * chrome.storage не сериализует Proxy-обёртку массива как массив.
   * @param {string} groupId
   * @param {string} signature - Подпись текущих настроек.
   * @param {Object} data - Поля состояния виджета.
   * @returns {Promise<void>}
   */
  async function save(groupId, signature, data) {
    const payload = {version, signature, savedAt: new Date().toISOString(), ...data};

    let json = JSON.stringify(payload);
    if (measureBytes(json) > maxBytes && trimPayload) {
      json = JSON.stringify(trimPayload(payload));
    }
    if (measureBytes(json) > maxBytes) return;

    try {
      await chrome.storage.local.set({[getStorageKey(groupId)]: JSON.parse(json)});
    } catch (error) {
      // Кэш — только ускорение первой отрисовки: данные уже на экране. Если записаться он не может
      // (кончилось место), убираем свой ключ, чтобы не мешать сохранять настройки
      console.warn(`Кэш ${getStorageKey(groupId)} не сохранён`, error);
      await clear(groupId).catch(() => {});
    }
  }

  /**
   * Сколько места занимает кэш группы — для подписи кнопки сброса.
   * @param {string} groupId
   * @returns {Promise<number>} Байты; ноль, если кэша нет.
   */
  async function getSizeBytes(groupId) {
    const storageKey = getStorageKey(groupId);
    try {
      return await chrome.storage.local.getBytesInUse(storageKey);
    } catch {
      // getBytesInUse для storage.local появился не сразу — там, где его нет, меряем сами
      const stored = await chrome.storage.local.get([storageKey]);
      return stored[storageKey] ? measureBytes(JSON.stringify(stored[storageKey])) : 0;
    }
  }

  /**
   * @param {string} groupId
   * @returns {Promise<void>}
   */
  async function clear(groupId) {
    await chrome.storage.local.remove([getStorageKey(groupId)]);
  }

  return {load, save, clear, getSizeBytes};
}
