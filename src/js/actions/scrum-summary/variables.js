export const defaultMonths = 6;
export const defaultIgnorePoints = 10;

export function computeTrendLine(data) {
  const n = data.length;
  if (n < 2) return [...data];

  const xMin = Math.min(...data.map((d) => d.x));
  const xMax = Math.max(...data.map((d) => d.x));
  const xRange = xMax - xMin || 1;

  const xs = data.map((d) => (d.x - xMin) / xRange);
  const ys = data.map((d) => d.y);

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return [
    { x: xMin, y: Math.max(0, Math.round(intercept)) },
    { x: xMax, y: Math.max(0, Math.round(intercept + slope)) },
  ];
}

/**
 * Медиана числового массива.
 * @param {number[]} sortedValues Значения, отсортированные по возрастанию
 * @returns {number} Медиана; для пустого массива — 0
 */
export function getMedian(sortedValues) {
  if (!sortedValues.length) return 0;

  const middle = Math.floor(sortedValues.length / 2);

  return sortedValues.length % 2
    ? sortedValues[middle]
    : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

/**
 * Считает средний и медианный балл по списку значений.
 * @param {number[]} points
 * @returns {{avg: number, median: number}}
 */
export function computePointsStats(points) {
  if (!points.length) return {avg: 0, median: 0};

  const sorted = [...points].sort((first, second) => first - second);
  const total = sorted.reduce((accumulator, value) => accumulator + value, 0);

  return {
    avg: Math.round(total / sorted.length),
    median: Math.round(getMedian(sorted)),
  };
}

/**
 * Схлопывает записи всех исполнителей в суммарные баллы команды по спринтам. Один спринт — один
 * комментарий с итогами, поэтому у всех его записей совпадает метка времени, по ней и группируем.
 * @param {{x: number, y: number, sprint: (number|null), userId: string}[]} sprintEntries
 * @returns {{x: number, y: number, sprint: (number|null), participantIds: string[]}[]} Записи по возрастанию даты
 */
export function aggregateTeamSprints(sprintEntries) {
  const sprintsByDate = new Map();

  sprintEntries.forEach(({x, y, sprint, userId}) => {
    const teamSprint = sprintsByDate.get(x) ?? {x, y: 0, sprint, participantIds: []};
    teamSprint.y += y;
    teamSprint.participantIds.push(userId);
    sprintsByDate.set(x, teamSprint);
  });

  return Array.from(sprintsByDate.values()).sort((first, second) => first.x - second.x);
}

/**
 * Приводит баллы спринтов к полному составу: сумма спринта делится на ожидаемый вклад тех, кто в
 * нём участвовал, и умножается на ожидаемый вклад всей команды. Без этого спринт с отпусками
 * занижает сумму, и тренд команды показывал бы спад даже когда каждый исполнитель растёт —
 * личный тренд считается только по спринтам, в которых человек работал, и отсутствия из него выпадают.
 * @param {{x: number, y: number, participantIds: string[]}[]} teamSprints
 * @param {Object<string, number>} expectedPointsByUser Ожидаемый вклад исполнителя за спринт
 * @returns {{x: number, y: number}[]}
 */
export function normalizeSprintsToFullTeam(teamSprints, expectedPointsByUser) {
  const expectedFull = Object.values(expectedPointsByUser).reduce((accumulator, points) => accumulator + points, 0);
  if (!expectedFull) return teamSprints.map(({x, y}) => ({x, y}));

  return teamSprints.map(({x, y, participantIds}) => {
    const expectedPresent = participantIds.reduce((accumulator, userId) => accumulator + (expectedPointsByUser[userId] ?? 0), 0);

    return {
      x,
      y: expectedPresent > 0 ? Math.round((y * expectedFull) / expectedPresent) : y,
    };
  });
}

/**
 * Тренд по методу линейной регрессии, приведённый к паре чисел «начало → конец».
 * @param {{x: number, y: number}[]} sprints
 * @returns {{trendLine: (Array|null), trendStart: (number|null), trendEnd: (number|null), trendDelta: (number|null), trendPct: (number|null)}}
 */
export function computeTrend(sprints) {
  const trendLine = sprints.length >= 2 ? computeTrendLine(sprints) : null;
  const trendStart = trendLine?.[0].y ?? null;
  const trendEnd = trendLine?.[trendLine.length - 1].y ?? null;
  const trendDelta = trendStart !== null && trendEnd !== null ? trendEnd - trendStart : null;
  const trendPct = trendDelta !== null && trendStart !== 0
    ? Math.round((trendDelta / trendStart) * 100)
    : null;

  return {trendLine, trendStart, trendEnd, trendDelta, trendPct};
}
