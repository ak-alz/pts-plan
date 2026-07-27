import dayjs from 'dayjs';
import {escape} from 'lodash-es';

import {minifyPrompt, pluralize} from '../../utils.js';

const chip = (s) => `<span class="rounded bg-surface-100 dark:bg-surface-800 font-semibold px-1">${escape(s)}</span>`;
const v = (label) => chip(`{ ${label} }`);

function formatDate(d) {
  const parsed = dayjs(d);
  return parsed.isValid() ? parsed.format('DD.MM.YYYY') : String(d);
}

function buildPeriodLabel(dateRange) {
  if (!dateRange?.[0]) return null;
  const days = dayjs(dateRange[1] ?? dateRange[0]).diff(dayjs(dateRange[0]), 'day') + 1;
  return `${days} ${pluralize(days, ['день', 'дня', 'дней'])} (${formatDate(dateRange[0])} — ${formatDate(dateRange[1] ?? dateRange[0])})`;
}

export function buildPromptPreview(dateRange, compareDateRange, extraContext) {
  const periodLabelChip = dateRange ? chip(buildPeriodLabel(dateRange)) : v('N дней (начало — конец)');
  const compareLabelChip = compareDateRange ? chip(buildPeriodLabel(compareDateRange)) : v('N дней (начало — конец)');
  const previewContext = extraContext != null ? chip(extraContext) : v('Доп. контекст');

  const note = (s) => `<span class="text-surface-400 dark:text-surface-500 text-xs">${escape(s)}</span>`;
  const previewData = `<span class="rounded bg-surface-100 dark:bg-surface-800 px-2 py-1 block">${[
    '[{',
    `  исполнитель: "Имя",  ${note('// в мульти-режиме')}`,
    '  баллов_всего: N,',
    '  задач_всего: N,',
    '  корневые_задачи: N,',
    '  хотфиксов: N,',
    '  коэф_декомпозиции: N,',
    '  средний_балл_за_задачу: N,',
    '  средний_балл_за_мес.: N,',
    '  распределение: "1б: N (N%), 3б: N (N%)",',
    '  топ_задач: ["Название (Nб)"],',
    `  ${note('// при сравнении с предыдущим периодом:')}`,
    '  дельта_баллов: ±N, дельта_задач: ±N,',
    '  дельта_коэф_декомп: ±N, дельта_балл_за_задачу: ±N, ...',
    `}, ${note('// при нескольких исполнителях — ещё один элемент с итогами:')}`,
    '{ исполнитель: "Итого", ...те же поля, без топ_задач }]',
  ].join('\n')}</span>`;

  return buildSystemPrompt(previewData, {
    extraContext: previewContext,
    periodLabelOverride: periodLabelChip,
    compareLabelOverride: compareLabelChip,
  });
}

export function buildSystemPrompt(aiData, {
  dateRange = null,
  compareDateRange = null,
  extraContext = '',
  periodLabelOverride = null,
  compareLabelOverride = null,
} = {}) {
  const periodLabel = periodLabelOverride ?? buildPeriodLabel(dateRange);
  const compareLabel = compareLabelOverride ?? buildPeriodLabel(compareDateRange);

  const extraSection = extraContext?.trim()
    ? `\nДополнительный контекст:\n${extraContext.trim()}\n`
    : '';

  const prompt = `Ты аналитик продуктивности команды разработки. Тебе предоставлена таблица KPI-метрик по закрытым задачам за период.

Баллы — оценка сложности задачи: чем больше баллов, тем сложнее задача.${periodLabel ? `\nАнализируемый период: ${periodLabel}` : ''}${compareLabel ? `\nСравнительный период (из него считаются дельты): ${compareLabel}` : ''}
${extraSection}
Дай краткий конструктивный анализ на русском языке:
- Общая продуктивность: как оценить результат за период
- Если несколько участников — сравни показатели, выдели лидеров и отстающих. Иначе пропусти этот пункт
- Распределение сложности задач: на что делается упор (мелкие / средние / крупные)
- Что стоит улучшить или на что обратить внимание

Будь конкретен, избегай общих фраз. Используй markdown: заголовки, списки, выделение. Объём — 150–300 слов.

Данные KPI (JSON):
${typeof aiData === 'string' ? aiData : JSON.stringify(aiData)}`;

  return minifyPrompt(prompt);
}
