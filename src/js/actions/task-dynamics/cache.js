import dayjs from 'dayjs';

/**
 * Кэш дневных агрегатов группы: одно открытие виджета за полгода — это больше шестидесяти вызовов
 * метода, и без кэша каждое повторное открытие платит их заново. Гранулярность дневная: бакет может
 * быть недельным с произвольным днём начала, и из месячных сумм такую неделю не собрать, а из дней
 * собирается любой бакет. Сырые задачи не кэшируются — только агрегаты, имена исполнителей и срез
 * «сейчас».
 *
 * Объём всё равно ограничиваем, хотя разрешение unlimitedStorage и снимает лимит хранилища: по
 * замерам дневные агрегаты активной группы весят около 190 КБ на год истории, а читается и
 * разбирается кэш целиком при каждом открытии виджета. Ограничений хватает двух — по возрасту дней и
 * по объёму на группу: групп у одной команды одна-две, десятков канбанов, между которыми имело бы
 * смысл вытеснять кэши друг друга, не бывает.
 */
const CACHE_KEY_PREFIX = 'task-dynamics-cache-';

/**
 * Версия структуры кэша: при изменении формата дневного агрегата кэш прошлой версии отбрасывается.
 * Версия 2 — из агрегата убран список подзадач (вместе с таблицей крупных подзадач).
 */
const CACHE_VERSION = 2;

/** Сколько живёт срез «сейчас» — он про текущее состояние канбана, а не про историю. */
const SNAPSHOT_MAX_AGE_MINUTES = 60;

/** Дни старше этого возраста не храним: такую историю всё равно не смотрят. */
const MAX_AGE_YEARS = 4;

/**
 * Предел на кэш одной группы. Обычно раньше срабатывает ограничение по возрасту дней выше — это
 * страховка для очень активных групп, где и четыре года укладываются в много мегабайт.
 */
const MAX_GROUP_BYTES = 3 * 1024 * 1024;

/**
 * @param {string} groupId
 * @returns {string} Ключ chrome.storage.local для кэша группы.
 */
export function getCacheStorageKey(groupId) {
  return `${CACHE_KEY_PREFIX}${groupId}`;
}

function createEmptyCache() {
  return {version: CACHE_VERSION, days: {}, users: {}, snapshot: null};
}

function measureBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Читает кэш группы; кэш прошлой версии формата отбрасывается целиком.
 * @param {string} groupId
 * @returns {Promise<{version: number, days: Object, users: Object, snapshot: Object|null}>}
 */
export async function loadCache(groupId) {
  const storageKey = getCacheStorageKey(groupId);
  const stored = await chrome.storage.local.get([storageKey]);
  const cache = stored[storageKey];
  if (!cache || cache.version !== CACHE_VERSION) return createEmptyCache();
  return {
    version: CACHE_VERSION,
    days: cache.days ?? {},
    users: cache.users ?? {},
    snapshot: cache.snapshot ?? null,
  };
}

/**
 * Отрезает самые старые дни, пока кэш группы не влезет в предел. Дни примерно равны по весу, поэтому
 * режем пропорционально и перепроверяем — измерять объём после каждого удалённого дня было бы на
 * порядок дороже.
 * @param {Object} days
 * @returns {Object} Дни, влезающие в предел.
 */
function trimDaysToBudget(days) {
  let payload = days;

  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = measureBytes(payload);
    if (bytes <= MAX_GROUP_BYTES) return payload;

    const dayKeys = Object.keys(payload).sort();
    const keepCount = Math.floor(dayKeys.length * (MAX_GROUP_BYTES / bytes) * 0.9);
    const dropCount = Math.max(1, dayKeys.length - keepCount);
    payload = {...payload};
    dayKeys.slice(0, dropCount).forEach((dayKey) => { delete payload[dayKey]; });
  }

  return payload;
}

/**
 * Сохраняет кэш группы, укладываясь в пределы объёма.
 * @param {string} groupId
 * @param {{days: Object, users: Object, snapshot: Object|null}} cache
 * @returns {Promise<void>}
 */
export async function saveCache(groupId, cache) {
  const oldestDayKey = dayjs().subtract(MAX_AGE_YEARS, 'year').format('YYYY-MM-DD');
  const freshDays = Object.fromEntries(
    Object.entries(cache.days).filter(([dayKey]) => dayKey >= oldestDayKey),
  );

  const payload = {
    version: CACHE_VERSION,
    days: trimDaysToBudget(freshDays),
    users: cache.users ?? {},
    snapshot: cache.snapshot ?? null,
  };

  try {
    await chrome.storage.local.set({[getCacheStorageKey(groupId)]: payload});
  } catch (e) {
    // Кэш — ускорение, а не данные: они уже в памяти виджета. Записаться он может не всегда (нет
    // разрешения unlimitedStorage в сборке, кончилось место на диске) — тогда отказываемся от кэша и
    // убираем свой ключ, чтобы не мешать остальным функциям сохранять настройки
    console.warn('Динамика задач: кэш не сохранён', e);
    await clearCache(groupId).catch(() => {});
  }
}

/**
 * Сколько места занимает кэш группы — для подписи кнопки сброса.
 * @param {string} groupId
 * @returns {Promise<number>} Байты; ноль, если кэша нет.
 */
export async function getCacheSizeBytes(groupId) {
  const storageKey = getCacheStorageKey(groupId);
  try {
    return await chrome.storage.local.getBytesInUse(storageKey);
  } catch {
    // getBytesInUse для storage.local появился не сразу — там, где его нет, меряем сами
    const stored = await chrome.storage.local.get([storageKey]);
    return stored[storageKey] ? measureBytes(stored[storageKey]) : 0;
  }
}

/**
 * @param {string} groupId
 * @returns {Promise<void>}
 */
export async function clearCache(groupId) {
  await chrome.storage.local.remove([getCacheStorageKey(groupId)]);
}

/**
 * Дни, которые придётся выгружать: те, которых нет в кэше, плюс последние сутки. Прошедшие дни почти
 * иммутабельны, но отмена завершения задачи перезаписывает дату закрытия, поэтому свежий хвост
 * перезагружаем всегда.
 * @param {Object} cachedDays - Дни из кэша (день без активности хранится пустым объектом).
 * @param {string[]} dayKeys - Все дни, нужные текущему запуску.
 * @returns {string[]} Дни к выгрузке.
 */
export function getMissingDayKeys(cachedDays, dayKeys) {
  const refetchFromDayKey = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  return dayKeys.filter((dayKey) => !cachedDays[dayKey] || dayKey >= refetchFromDayKey);
}

/**
 * Дни без перечисленных ключей. «Обновить» сбрасывает только дни текущего запуска, а не весь кэш
 * группы: иначе обновление за месяц выкидывало бы годы уже выгруженной истории.
 * @param {Object} days - Дневные агрегаты.
 * @param {string[]} dayKeys - Дни, которые нужно убрать.
 * @returns {Object} Новый объект без этих дней.
 */
export function omitDays(days, dayKeys) {
  const dropped = new Set(dayKeys);
  return Object.fromEntries(Object.entries(days ?? {}).filter(([dayKey]) => !dropped.has(dayKey)));
}

/**
 * Помечает дни как выгруженные: день без задач иначе считался бы незакэшированным вечно.
 * @param {Object} days - Дневные агрегаты (мутируется).
 * @param {string[]} dayKeys
 * @returns {Object} Те же дни.
 */
export function markDaysCovered(days, dayKeys) {
  dayKeys.forEach((dayKey) => {
    if (!days[dayKey]) days[dayKey] = {};
  });
  return days;
}

/**
 * @param {Object|null} snapshot - Срез из кэша.
 * @returns {boolean} Свежий ли срез «сейчас».
 */
export function isSnapshotFresh(snapshot) {
  if (!snapshot?.at) return false;
  return dayjs().diff(dayjs(snapshot.at), 'minute') < SNAPSHOT_MAX_AGE_MINUTES;
}
