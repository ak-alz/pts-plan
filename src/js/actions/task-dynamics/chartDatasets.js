/**
 * Фабрики датасетов Chart.js для вкладок «Динамики»: у всех графиков одинаковая база (столбцы —
 * счётчики по левой оси, линии — производные показатели по правой), поэтому оформление задаётся здесь,
 * а компоненты вкладок остаются про данные.
 */

/**
 * Предел ширины столбца в пикселях. Без него на коротком диапазоне (один-два бакета) столбец
 * растягивается на всю ширину графика и выглядит как заливка, а не как столбец.
 */
const MAX_BAR_THICKNESS = 56;

/**
 * Порядок отрисовки. Chart.js сортирует датасеты по `order` по возрастанию, а рисует их с конца
 * списка — значит меньший `order` рисуется последним и оказывается сверху. Без этого линии (они идут
 * в массиве после столбцов) уезжали под столбцы.
 */
const LINE_DRAW_ORDER = 0;
const BAR_DRAW_ORDER = 1;

/**
 * Столбцы графика.
 * @param {Object} params
 * @param {string} params.label - Подпись датасета (она же переключатель видимости).
 * @param {Array<number|null>} params.data - Значения по бакетам.
 * @param {string} params.color - HEX-цвет.
 * @param {string} [params.yAxisID] - Ось (`y` — левая, `y1` — правая).
 * @param {string} [params.valueSuffix] - Единица для подсказки (например `%` или ` дн.`).
 * @param {string} [params.stack] - Имя стека для накопительных столбцов.
 * @returns {Object} Датасет Chart.js.
 */
export function barDataset({label, data, color, yAxisID = 'y', valueSuffix = '', stack = undefined}) {
  return {
    type: 'bar',
    label,
    data,
    yAxisID,
    valueSuffix,
    stack,
    backgroundColor: color,
    borderColor: color,
    borderWidth: 0,
    borderRadius: 2,
    categoryPercentage: 0.7,
    barPercentage: 0.9,
    maxBarThickness: MAX_BAR_THICKNESS,
    order: BAR_DRAW_ORDER,
  };
}

/**
 * Линия графика.
 * @param {Object} params
 * @param {string} params.label - Подпись датасета.
 * @param {Array<number|null>} params.data - Значения по бакетам (`null` — разрыв линии).
 * @param {string} params.color - HEX-цвет.
 * @param {string} [params.yAxisID] - Ось (`y` — левая, `y1` — правая).
 * @param {string} [params.valueSuffix] - Единица для подсказки.
 * @param {number[]} [params.dash] - `borderDash` для различения линий похожего цвета.
 * @param {string} [params.pointStyle] - Форма точки.
 * @returns {Object} Датасет Chart.js.
 */
export function lineDataset({label, data, color, yAxisID = 'y1', valueSuffix = '', dash = [], pointStyle = 'circle'}) {
  return {
    type: 'line',
    label,
    data,
    yAxisID,
    valueSuffix,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    borderDash: dash,
    tension: 0.3,
    pointStyle,
    pointRadius: 3,
    spanGaps: false,
    order: LINE_DRAW_ORDER,
  };
}
