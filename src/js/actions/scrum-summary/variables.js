export const defaultMaxSprints = 24;
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
