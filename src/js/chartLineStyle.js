import {Legend} from 'chart.js';

/**
 * Ширина значка линии в легенде и подсказке графика, px: на ней должен уместиться хотя бы один
 * период самого длинного штриха из LINE_DASH_STYLES.
 */
const LINE_SYMBOL_WIDTH = 28;
const LINE_SYMBOL_HEIGHT = 12;
const LINE_SYMBOL_WIDTH_PX = 2;

const lineSymbolCache = new Map();

// У scatter линия выключена по умолчанию, у line — включена
function isLineDataset(chart, datasetIndex) {
  const showLine = chart.data.datasets[datasetIndex]?.showLine;
  const type = chart.getDatasetMeta(datasetIndex).type;
  return (type === 'line' && showLine !== false) || (type === 'scatter' && showLine === true);
}

// Подсказка Chart.js не применяет borderDash к значку, поэтому линия рисуется картинкой;
// картинка в разрешении экрана, иначе на HiDPI штрихи размыты
function getLineSymbol(color, dash) {
  const key = `${color}|${dash.join(',')}`;
  if (lineSymbolCache.has(key)) return lineSymbolCache.get(key);

  const pixelRatio = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = LINE_SYMBOL_WIDTH * pixelRatio;
  canvas.height = LINE_SYMBOL_HEIGHT * pixelRatio;
  const context = canvas.getContext('2d');
  context.scale(pixelRatio, pixelRatio);
  context.strokeStyle = color;
  context.lineWidth = LINE_SYMBOL_WIDTH_PX;
  context.setLineDash(dash);
  context.beginPath();
  context.moveTo(0, LINE_SYMBOL_HEIGHT / 2);
  context.lineTo(LINE_SYMBOL_WIDTH, LINE_SYMBOL_HEIGHT / 2);
  context.stroke();

  const image = new Image(LINE_SYMBOL_WIDTH, LINE_SYMBOL_HEIGHT);
  image.src = canvas.toDataURL();
  lineSymbolCache.set(key, image);
  return image;
}

/**
 * `generateLabels` легенды Chart.js: у линейных датасетов вместо точки — отрезок линии
 * с её цветом и `borderDash`, остальные (столбцы) остаются как есть.
 * @param {import('chart.js').Chart} chart - График.
 * @returns {Object[]} Элементы легенды.
 */
function generateLineLegendLabels(chart) {
  return Legend.defaults.labels.generateLabels(chart).map((item) => {
    if (!isLineDataset(chart, item.datasetIndex)) return item;
    // При usePointStyle Chart.js берёт стиль элемента у точки, а не у линии — у точки нет borderDash
    const {borderColor, borderDash = []} = chart.data.datasets[item.datasetIndex];
    // Картинка для подсказки готовится заранее: data URL декодируется асинхронно, и при первом
    // наведении значок иначе был бы пустым
    getLineSymbol(borderColor, borderDash);
    return {
      ...item,
      pointStyle: 'line',
      rotation: 0,
      strokeStyle: borderColor,
      lineDash: borderDash,
      lineWidth: LINE_SYMBOL_WIDTH_PX,
    };
  });
}

/**
 * Опции `plugins.legend.labels` для графика, где похожие по цвету линии различаются штрихом:
 * в легенде линии рисуются отрезками со своим стилем, а не точками.
 */
export const lineLegendLabels = {
  usePointStyle: true,
  pointStyleWidth: LINE_SYMBOL_WIDTH,
  generateLabels: generateLineLegendLabels,
};

/**
 * Опции `plugins.tooltip` (без `callbacks`) для такого же графика — место под значок линии в подсказке.
 * Пару к ним — колбэк `labelPointStyle: getLineTooltipPointStyle`.
 */
export const lineTooltipOptions = {
  usePointStyle: true,
  boxWidth: LINE_SYMBOL_WIDTH,
  boxHeight: LINE_SYMBOL_HEIGHT,
};

/**
 * Колбэк `tooltip.callbacks.labelPointStyle`: у линейного датасета значок — отрезок линии
 * с её цветом и `borderDash`, у остальных — их собственная форма точки.
 * @param {Object} context - Контекст элемента подсказки Chart.js.
 * @returns {{pointStyle: string|HTMLImageElement, rotation: number}} Значок для строки подсказки.
 */
export function getLineTooltipPointStyle(context) {
  const {chart, dataset, datasetIndex, dataIndex} = context;
  if (!isLineDataset(chart, datasetIndex)) {
    const style = chart.getDatasetMeta(datasetIndex).controller.getStyle(dataIndex);
    return {pointStyle: style.pointStyle, rotation: style.rotation};
  }
  return {pointStyle: getLineSymbol(dataset.borderColor, dataset.borderDash ?? []), rotation: 0};
}
