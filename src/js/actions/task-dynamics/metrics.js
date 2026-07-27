import dayjs from 'dayjs';

import {getTaskPointsFromName, isHotfixTask} from '../../utils.js';
import {AGE_BUCKETS, MOVING_AVERAGE_WINDOW, STALE_DAYS} from './variables.js';

const REJECTED_STATUS = 7;

/**
 * Классы задач, на которые разбит каждый дневной агрегат. Классы не пересекаются, поэтому и разрез
 * («все задачи» — четыре класса, «только корневые» — два root-класса), и метрики хотфиксов
 * (два hotfix-класса) собираются их сложением. За счёт этого времена задач и разбивка по исполнителям
 * лежат в памяти и в кэше по одному разу, а не копиями под каждый разрез.
 */
export const TASK_CLASSES = ['rootHotfix', 'rootRegular', 'subHotfix', 'subRegular'];
const ROOT_CLASSES = ['rootHotfix', 'rootRegular'];
const HOTFIX_CLASSES = ['rootHotfix', 'subHotfix'];
// Разрезов два: все задачи и только корневые. Hotfix-классы остаются — они нужны метрикам качества,
// но отдельным разрезом не выбираются: анализировать одни хотфиксы смысла нет, для них есть вкладка
const CUT_CLASSES = {
  all: TASK_CLASSES,
  root: ROOT_CLASSES,
};

function round1(value) {
  return Math.round(value * 10) / 10;
}

function share(part, whole) {
  return whole ? round1((part / whole) * 100) : 0;
}

/**
 * Приводит задачу из ответа tasks.task.list к плоскому виду, на котором считаются все метрики.
 * @param {Object} task - Задача из ответа API (camelCase-поля).
 * @returns {Object} Плоская задача с уже вычисленными баллами и признаками хотфикса и корневой.
 */
export function normalizeTask(task) {
  const title = task.title ?? '';
  const parentId = String(task.parentId ?? '0');
  return {
    id: String(task.id),
    title,
    responsibleId: String(task.responsible?.id ?? task.responsibleId ?? '0'),
    responsibleName: task.responsible?.name ?? null,
    createdDate: task.createdDate ?? null,
    closedDate: task.closedDate ?? null,
    activityDate: task.activityDate ?? null,
    stageId: String(task.stageId ?? ''),
    status: Number(task.status ?? 0),
    // Bitrix отдаёт поля списка в camelCase, но у COMMENTS_COUNT встречается и исходное имя
    commentsCount: Number(task.commentsCount ?? task.COMMENTS_COUNT ?? 0),
    parentId,
    isRoot: parentId === '0',
    isHotfix: isHotfixTask(title),
    points: getTaskPointsFromName(title),
  };
}

function getTaskClass(task) {
  if (task.isRoot) return task.isHotfix ? 'rootHotfix' : 'rootRegular';
  return task.isHotfix ? 'subHotfix' : 'subRegular';
}

function formatDayKey(date) {
  if (!date) return null;
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
}

function createEmptyAggregate() {
  return {
    created: 0,
    closed: 0,
    points: 0,
    comments: 0,
    closedWithPoints: 0,
    pointCounts: {},
    leadTimes: [],
    byUser: {},
  };
}

/**
 * Время от постановки до закрытия в днях с одним знаком. Единственная доступная метрика времени:
 * фаз «лежала в бэклоге» и «делали» в данных нет (DATE_START не заполняется).
 * @param {Object} task - Нормализованная задача.
 * @returns {number|null} Дни, либо `null`, если одной из дат нет.
 */
export function getLeadTimeDays(task) {
  if (!task.createdDate || !task.closedDate) return null;
  const created = dayjs(task.createdDate);
  const closed = dayjs(task.closedDate);
  if (!created.isValid() || !closed.isValid()) return null;
  return Math.max(0, round1(closed.diff(created, 'hour') / 24));
}

/**
 * Сворачивает выгруженные задачи в дневные агрегаты по классам задач. Гранулярность именно дневная,
 * хотя бакет графиков всегда месяц: период и диапазон сравнения задаются с точностью до дня и режут
 * крайние месяцы, сравнение «до и после события» делит период по дате, а кэш докачивает недостающие
 * дни — из месячных сумм ничего этого не собрать.
 * @param {Object[]} createdTasks - Нормализованные задачи, созданные в диапазоне.
 * @param {Object[]} closedTasks - Нормализованные задачи, закрытые в диапазоне.
 * @returns {Record<string, Record<string, Object>>} Карта `'YYYY-MM-DD'` → класс задачи → агрегат.
 */
export function buildDayAggregates(createdTasks, closedTasks) {
  const days = {};

  const getAggregate = (dayKey, taskClass) => {
    if (!days[dayKey]) days[dayKey] = {};
    if (!days[dayKey][taskClass]) days[dayKey][taskClass] = createEmptyAggregate();
    return days[dayKey][taskClass];
  };

  createdTasks.forEach((task) => {
    if (task.status === REJECTED_STATUS) return;
    const dayKey = formatDayKey(task.createdDate);
    if (!dayKey) return;
    getAggregate(dayKey, getTaskClass(task)).created += 1;
  });

  closedTasks.forEach((task) => {
    if (task.status === REJECTED_STATUS) return;
    const dayKey = formatDayKey(task.closedDate);
    if (!dayKey) return;
    const aggregate = getAggregate(dayKey, getTaskClass(task));
    aggregate.closed += 1;
    aggregate.points += task.points;
    aggregate.comments += task.commentsCount;
    if (task.points > 0) {
      aggregate.closedWithPoints += 1;
      aggregate.pointCounts[task.points] = (aggregate.pointCounts[task.points] ?? 0) + 1;
    }

    const leadTime = getLeadTimeDays(task);
    if (leadTime !== null) aggregate.leadTimes.push(leadTime);

    if (!aggregate.byUser[task.responsibleId]) aggregate.byUser[task.responsibleId] = {closed: 0, points: 0};
    aggregate.byUser[task.responsibleId].closed += 1;
    aggregate.byUser[task.responsibleId].points += task.points;
  });

  return days;
}

/**
 * Складывает несколько агрегатов в один.
 * @param {Object[]} aggregates
 * @returns {Object} Суммарный агрегат.
 */
export function sumAggregates(aggregates) {
  const result = createEmptyAggregate();
  aggregates.forEach((aggregate) => {
    if (!aggregate) return;
    result.created += aggregate.created ?? 0;
    result.closed += aggregate.closed ?? 0;
    result.points += aggregate.points ?? 0;
    result.comments += aggregate.comments ?? 0;
    result.closedWithPoints += aggregate.closedWithPoints ?? 0;
    Object.entries(aggregate.pointCounts ?? {}).forEach(([points, count]) => {
      result.pointCounts[points] = (result.pointCounts[points] ?? 0) + count;
    });
    if (aggregate.leadTimes?.length) result.leadTimes.push(...aggregate.leadTimes);
    Object.entries(aggregate.byUser ?? {}).forEach(([userId, stat]) => {
      if (!result.byUser[userId]) result.byUser[userId] = {closed: 0, points: 0};
      result.byUser[userId].closed += stat.closed ?? 0;
      result.byUser[userId].points += stat.points ?? 0;
    });
  });
  return result;
}

function collectAggregate(days, dayKeys, classKeys) {
  const aggregates = [];
  dayKeys.forEach((dayKey) => {
    const day = days[dayKey];
    if (!day) return;
    classKeys.forEach((classKey) => {
      if (day[classKey]) aggregates.push(day[classKey]);
    });
  });
  return sumAggregates(aggregates);
}

/**
 * Перцентиль по массиву значений методом nearest-rank (без интерполяции).
 * @param {number[]} values - Значения отдельных задач, не агрегаты.
 * @param {number} percentileShare - Доля от 0 до 1 (0.5 — медиана).
 * @returns {number|null} Значение перцентиля с одним знаком, либо `null` для пустого массива.
 */
export function percentile(values, percentileShare) {
  if (!values?.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentileShare * sorted.length) - 1));
  return round1(sorted[index]);
}

/**
 * Состав команды и отсечённый хвост. Состав — исполнители, давшие не меньше `contributionThresholdPercent`
 * процентов баллов; порог относительный, потому что абсолютное число баллов пришлось бы подбирать под
 * каждую команду и длину периода. Если состав уже посчитан по всему периоду, он передаётся в `memberIds` —
 * тогда отпуск или болезнь не выкидывают человека из состава задним числом.
 * @param {Record<string, {closed: number, points: number}>} byUser - Закрытые задачи и баллы по исполнителям.
 * @param {Object} options
 * @param {number} [options.contributionThresholdPercent] - Порог вклада в процентах от баллов периода (0 — не фильтровать).
 * @param {string[]} [options.excludedUserIds] - Исполнители, исключённые вручную.
 * @param {Set<string>|null} [options.memberIds] - Готовый состав периода.
 * @returns {Object} Состав, полный список исполнителей с флагами и суммы по отсечённым.
 */
export function computeTeamComposition(byUser, {
  contributionThresholdPercent = 1,
  excludedUserIds = [],
  memberIds = null,
} = {}) {
  const excluded = new Set(excludedUserIds.map(String));
  const entries = Object.entries(byUser ?? {}).map(([userId, stat]) => ({
    userId,
    closed: stat.closed ?? 0,
    points: stat.points ?? 0,
  }));

  const includedEntries = entries.filter((entry) => !excluded.has(entry.userId));
  const totalPoints = includedEntries.reduce((sum, entry) => sum + entry.points, 0);
  const thresholdPoints = contributionThresholdPercent > 0
    ? (totalPoints * contributionThresholdPercent) / 100
    : 0;

  const isMember = (entry) => {
    if (excluded.has(entry.userId)) return false;
    if (memberIds) return memberIds.has(entry.userId);
    // Когда баллов нет вообще (старые задачи без оценки), порог отсёк бы всех — считаем составом всех активных
    if (contributionThresholdPercent <= 0 || totalPoints === 0) return true;
    return entry.points >= thresholdPoints && entry.points > 0;
  };

  const all = entries
    .map((entry) => ({
      ...entry,
      pointsShare: share(entry.points, totalPoints),
      isExcluded: excluded.has(entry.userId),
      isMember: isMember(entry),
    }))
    .sort((a, b) => b.points - a.points || b.closed - a.closed);

  const members = all.filter((entry) => entry.isMember);
  const others = all.filter((entry) => !entry.isMember && !entry.isExcluded);
  const excludedEntries = all.filter((entry) => entry.isExcluded);

  const sumField = (list, field) => list.reduce((sum, entry) => sum + entry[field], 0);

  return {
    all,
    members,
    memberIds: new Set(members.map((entry) => entry.userId)),
    memberPoints: sumField(members, 'points'),
    memberClosed: sumField(members, 'closed'),
    others: {count: others.length, closed: sumField(others, 'closed'), points: sumField(others, 'points')},
    excluded: {count: excludedEntries.length, closed: sumField(excludedEntries, 'closed'), points: sumField(excludedEntries, 'points')},
    totalPoints,
    thresholdPoints: round1(thresholdPoints),
  };
}

function buildSizeDistribution(pointCounts) {
  const totalWithPoints = Object.values(pointCounts).reduce((sum, count) => sum + count, 0);
  return Object.entries(pointCounts)
    .map(([points, count]) => ({
      points: Number(points),
      count,
      share: share(count, totalWithPoints),
    }))
    .sort((a, b) => a.points - b.points);
}

/**
 * Все метрики за набор дней в заданном разрезе — один источник цифр для сводки, графиков, выгрузки и AI.
 * @param {Record<string, Record<string, Object>>} days - Дневные агрегаты.
 * @param {string[]} dayKeys - Дни, попадающие в расчёт.
 * @param {Object} options
 * @param {'all'|'root'} [options.cut] - Разрез по типу задач.
 * @param {number} [options.contributionThresholdPercent] - Порог вклада исполнителя.
 * @param {string[]} [options.excludedUserIds] - Исполнители, исключённые вручную.
 * @param {Set<string>|null} [options.memberIds] - Готовый состав команды периода.
 * @param {number} [options.periodMonths] - Длина периода в месяцах для «в месяц»-метрик.
 * @returns {Object} Метрики периода.
 */
export function computeMetrics(days, dayKeys, {
  cut = 'all',
  contributionThresholdPercent = 1,
  excludedUserIds = [],
  memberIds = null,
  periodMonths = 1,
} = {}) {
  const cutClasses = CUT_CLASSES[cut] ?? TASK_CLASSES;
  const hotfixClasses = cutClasses.filter((classKey) => HOTFIX_CLASSES.includes(classKey));
  const regularClasses = cutClasses.filter((classKey) => !HOTFIX_CLASSES.includes(classKey));
  const rootClasses = cutClasses.filter((classKey) => ROOT_CLASSES.includes(classKey));

  const total = collectAggregate(days, dayKeys, cutClasses);
  const hotfixPart = collectAggregate(days, dayKeys, hotfixClasses);
  const regularPart = collectAggregate(days, dayKeys, regularClasses);
  const rootPart = collectAggregate(days, dayKeys, rootClasses);

  // «Задач на корневую» разрез не применяет: в разрезе «только корневые» числитель и знаменатель
  // оказались бы одним множеством, и отношение всегда равнялось бы единице
  const everyTask = cutClasses.length === TASK_CLASSES.length
    ? total
    : collectAggregate(days, dayKeys, TASK_CLASSES);
  const everyRoot = rootClasses.length === ROOT_CLASSES.length
    ? rootPart
    : collectAggregate(days, dayKeys, ROOT_CLASSES);

  const team = computeTeamComposition(total.byUser, {contributionThresholdPercent, excludedUserIds, memberIds});
  const months = Math.max(1, periodMonths);

  return {
    created: total.created,
    closed: total.closed,
    netDebt: total.created - total.closed,
    points: total.points,
    closedWithPoints: total.closedWithPoints,
    pointsCoverage: share(total.closedWithPoints, total.closed),
    avgPointsPerTask: total.closed ? round1(total.points / total.closed) : 0,
    closedPerMonth: round1(total.closed / months),
    pointsPerMonth: round1(total.points / months),
    createdPerMonth: round1(total.created / months),
    hotfixes: hotfixPart.closed,
    hotfixShare: share(hotfixPart.closed, total.closed),
    hotfixLeadTimeMedian: percentile(hotfixPart.leadTimes, 0.5),
    regularLeadTimeMedian: percentile(regularPart.leadTimes, 0.5),
    leadTimeMedian: percentile(total.leadTimes, 0.5),
    leadTimeP85: percentile(total.leadTimes, 0.85),
    roots: rootPart.closed,
    subtasksPerRoot: everyRoot.closed ? round1(everyTask.closed / everyRoot.closed) : 0,
    commentsPerTask: total.closed ? round1(total.comments / total.closed) : 0,
    sizeDistribution: buildSizeDistribution(total.pointCounts),
    teamSize: team.members.length,
    pointsPerPerson: team.members.length ? round1(team.memberPoints / team.members.length) : 0,
    tasksPerPerson: team.members.length ? round1(team.memberClosed / team.members.length) : 0,
    team,
    byUser: total.byUser,
  };
}

/**
 * Дни диапазона включительно.
 * @param {[Date, Date]} dateRange
 * @returns {string[]} Ключи дней `'YYYY-MM-DD'`.
 */
export function getDayKeys(dateRange) {
  if (!dateRange?.[0]) return [];
  const start = dayjs(dateRange[0]).startOf('day');
  const end = dayjs(dateRange[1] ?? dateRange[0]).startOf('day');
  const dayKeys = [];
  let cursor = start;
  while (!cursor.isAfter(end)) {
    dayKeys.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(1, 'day');
  }
  return dayKeys;
}

/**
 * Склеивает подряд идущие дни в непрерывные диапазоны — один запрос на диапазон вместо запроса на день.
 * Нужно, когда период и диапазон сравнения стыкуются: тогда это одна выборка, а не две.
 * @param {string[]} dayKeys - Дни в любом порядке.
 * @returns {Array<{from: string, to: string}>} Диапазоны по возрастанию.
 */
export function groupDaysIntoRanges(dayKeys) {
  const sorted = [...new Set(dayKeys)].sort();
  const ranges = [];

  sorted.forEach((dayKey) => {
    const lastRange = ranges[ranges.length - 1];
    if (lastRange && dayjs(lastRange.to).add(1, 'day').format('YYYY-MM-DD') === dayKey) {
      lastRange.to = dayKey;
      return;
    }
    ranges.push({from: dayKey, to: dayKey});
  });

  return ranges;
}

/**
 * Месячные бакеты периода. Крайние бакеты обрезаются границами периода, поэтому могут быть неполными
 * (`isPartial`) — например когда период начинается с середины месяца.
 * @param {[Date, Date]} dateRange
 * @returns {Array<{key: string, label: string, dayKeys: string[], isPartial: boolean}>}
 */
export function buildBuckets(dateRange) {
  if (!dateRange?.[0]) return [];
  const start = dayjs(dateRange[0]).startOf('day');
  const end = dayjs(dateRange[1] ?? dateRange[0]).startOf('day');
  if (end.isBefore(start)) return [];

  const buckets = [];
  let cursor = start.startOf('month');

  while (!cursor.isAfter(end)) {
    const bucketEnd = cursor.endOf('month').startOf('day');
    const from = cursor.isBefore(start) ? start : cursor;
    const to = bucketEnd.isAfter(end) ? end : bucketEnd;
    buckets.push({
      key: cursor.format('YYYY-MM'),
      label: cursor.format('MM.YYYY'),
      dayKeys: getDayKeys([from.toDate(), to.toDate()]),
      isPartial: cursor.isBefore(start) || bucketEnd.isAfter(end),
      startDate: from.format('YYYY-MM-DD'),
      endDate: to.format('YYYY-MM-DD'),
    });
    cursor = cursor.add(1, 'month');
  }

  return buckets;
}

/**
 * Метрики по бакетам плюс накопительный долг и скользящее среднее закрытий.
 * @param {Record<string, Record<string, Object>>} days - Дневные агрегаты.
 * @param {Array<Object>} buckets - Результат buildBuckets.
 * @param {Object} options - Те же опции, что у computeMetrics (`memberIds` — состав всего периода).
 * @returns {Object[]} Строка на бакет.
 */
export function computeBucketRows(days, buckets, options = {}) {
  const memberIds = options.memberIds ?? null;
  let cumulativeDebt = 0;

  const rows = buckets.map((bucket) => {
    const metrics = computeMetrics(days, bucket.dayKeys, {...options, periodMonths: 1});
    cumulativeDebt += metrics.netDebt;

    const memberEntries = Object.entries(metrics.byUser)
      .filter(([userId]) => !memberIds || memberIds.has(userId));
    const activeUsers = memberEntries.filter(([, stat]) => stat.closed > 0).length;
    const memberPoints = memberEntries.reduce((sum, [, stat]) => sum + stat.points, 0);

    return {
      ...metrics,
      key: bucket.key,
      label: bucket.label,
      isPartial: bucket.isPartial,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      cumulativeDebt,
      activeUsers,
      memberPoints,
      pointsPerActiveUser: activeUsers ? round1(memberPoints / activeUsers) : 0,
    };
  });

  rows.forEach((row, index) => {
    // На первых бакетах окна ещё нет — линию там не рисуем, а не занижаем её неполной суммой
    if (index + 1 < MOVING_AVERAGE_WINDOW) {
      row.closedMovingAverage = null;
      return;
    }
    const window = rows.slice(index + 1 - MOVING_AVERAGE_WINDOW, index + 1);
    row.closedMovingAverage = round1(window.reduce((sum, item) => sum + item.closed, 0) / MOVING_AVERAGE_WINDOW);
  });

  return rows;
}

/**
 * Позиции событий на оси бакетов: индекс бакета и доля внутри него — чтобы вертикальная линия стояла
 * не в центре месяца, а примерно на дате.
 * @param {Array<{date: string, label: string}>} milestones
 * @param {Array<Object>} buckets - Результат buildBuckets.
 * @returns {Array<{label: string, date: string, bucketIndex: number, positionInBucket: number}>}
 */
export function mapMilestonesToBuckets(milestones, buckets) {
  if (!milestones?.length || !buckets.length) return [];

  return milestones
    .map((milestone) => {
      const date = dayjs(milestone.date);
      if (!date.isValid()) return null;
      const dayKey = date.format('YYYY-MM-DD');
      const bucketIndex = buckets.findIndex((bucket) => bucket.dayKeys.includes(dayKey));
      if (bucketIndex === -1) return null;
      const bucket = buckets[bucketIndex];
      const positionInBucket = bucket.dayKeys.indexOf(dayKey) / Math.max(1, bucket.dayKeys.length);
      return {label: milestone.label || dayKey, date: dayKey, bucketIndex, positionInBucket};
    })
    .filter(Boolean)
    .sort((a, b) => a.bucketIndex - b.bucketIndex);
}

/**
 * Срез «сейчас» по незакрытым задачам: возраст и давность активности задач каждой колонки канбана.
 * Возраст и давность хранятся массивами, чтобы медиану и корзины можно было пересчитать после смены
 * разметки колонок без повторной выгрузки.
 * @param {Object[]} activeTasks - Нормализованные незакрытые задачи группы.
 * @param {string|Date} [now] - Момент среза.
 * @returns {Record<string, {total: number, ageDays: number[], inactiveDays: number[]}>} Карта stageId → срез.
 */
export function buildStageSnapshots(activeTasks, now = undefined) {
  const moment = dayjs(now);
  const snapshots = {};

  activeTasks.forEach((task) => {
    // Фильтр «не завершена» пропускает и отклонённые задачи — в очереди им не место
    if (task.status === REJECTED_STATUS) return;
    const stageId = task.stageId || 'unknown';
    if (!snapshots[stageId]) snapshots[stageId] = {total: 0, ageDays: [], inactiveDays: []};
    snapshots[stageId].total += 1;
    if (task.createdDate) {
      snapshots[stageId].ageDays.push(Math.max(0, moment.diff(dayjs(task.createdDate), 'day')));
    }
    if (task.activityDate) {
      snapshots[stageId].inactiveDays.push(Math.max(0, moment.diff(dayjs(task.activityDate), 'day')));
    }
  });

  return snapshots;
}

function buildAgeBuckets(ageDays) {
  const counts = Object.fromEntries(AGE_BUCKETS.map((bucket) => [bucket.key, 0]));
  ageDays.forEach((age) => {
    const bucket = AGE_BUCKETS.find((item) => item.maxDays === null || age < item.maxDays);
    counts[bucket.key] += 1;
  });
  return counts;
}

function buildStageRow(stageId, snapshot, stageById) {
  const stage = stageById[stageId];
  return {
    stageId,
    name: stage?.TITLE ?? `Колонка ${stageId}`,
    color: stage?.COLOR ? `#${String(stage.COLOR).replace('#', '')}` : null,
    total: snapshot.total,
    ageBuckets: buildAgeBuckets(snapshot.ageDays),
    medianAge: percentile(snapshot.ageDays, 0.5),
    p85Age: percentile(snapshot.ageDays, 0.85),
    staleCount: snapshot.inactiveDays.filter((days) => days > STALE_DAYS).length,
    medianInactive: percentile(snapshot.inactiveDays, 0.5),
  };
}

function buildGroupSummary(rows, snapshots) {
  const ageDays = rows.flatMap((row) => snapshots[row.stageId].ageDays);
  const inactiveDays = rows.flatMap((row) => snapshots[row.stageId].inactiveDays);
  return {
    total: rows.reduce((sum, row) => sum + row.total, 0),
    byStage: rows.sort((a, b) => b.total - a.total),
    ageBuckets: buildAgeBuckets(ageDays),
    medianAge: percentile(ageDays, 0.5),
    p85Age: percentile(ageDays, 0.85),
    staleCount: inactiveDays.filter((days) => days > STALE_DAYS).length,
  };
}

/**
 * Раскладывает срез «сейчас» на три группы колонок: реальная очередь бэклога, взятое в текущий спринт
 * (всё неразмеченное) и исключённое из расчётов (архивные свалки). Историю по колонкам так получить
 * нельзя — STAGE_ID хранит только текущую колонку, — а на срезе это единственный источник таких цифр.
 * @param {Record<string, Object>} stageSnapshots - Результат buildStageSnapshots.
 * @param {Object} options
 * @param {string[]} options.backlogStageIds - Колонки реальной очереди.
 * @param {string[]} options.excludedStageIds - Колонки, исключённые из расчётов.
 * @param {Object[]} options.stages - Колонки канбана из task.stages.get (для названий и цветов).
 * @returns {{backlog: Object, sprint: Object, excluded: Object}}
 */
export function computeBacklogSnapshot(stageSnapshots, {backlogStageIds = [], excludedStageIds = [], stages = []} = {}) {
  const stageById = Object.fromEntries(stages.map((stage) => [String(stage.ID), stage]));
  const backlogIds = new Set(backlogStageIds.map(String));
  const excludedIds = new Set(excludedStageIds.map(String));

  const groups = {backlog: [], sprint: [], excluded: []};
  Object.entries(stageSnapshots).forEach(([stageId, snapshot]) => {
    const row = buildStageRow(stageId, snapshot, stageById);
    if (excludedIds.has(stageId)) groups.excluded.push(row);
    else if (backlogIds.has(stageId)) groups.backlog.push(row);
    else groups.sprint.push(row);
  });

  return {
    backlog: buildGroupSummary(groups.backlog, stageSnapshots),
    sprint: buildGroupSummary(groups.sprint, stageSnapshots),
    excluded: buildGroupSummary(groups.excluded, stageSnapshots),
  };
}
