import dayjs from 'dayjs';
import {escape} from 'lodash-es';

import {minifyPrompt, pluralize} from '../../utils.js';

const chip = (s) => `<span class="rounded bg-surface-100 font-semibold px-1">${escape(s)}</span>`;
const v = (label) => chip(`{ ${label} }`);

function formatDate(d) {
  const parsed = dayjs(d);
  return parsed.isValid() ? parsed.format('DD.MM.YYYY') : String(d);
}

export function buildPromptPreview(dateRange, extraContext) {
  const rawDays = dateRange ? dayjs(dateRange[1]).diff(dayjs(dateRange[0]), 'day') + 1 : null;
  const periodLabelChip = dateRange
    ? chip(`${rawDays} ${pluralize(rawDays, ['день', 'дня', 'дней'])} (${formatDate(dateRange[0])} — ${formatDate(dateRange[1])})`)
    : v('N дней (начало — конец)');
  const previewContext = extraContext != null ? chip(extraContext) : v('Доп. контекст');

  const note = (s) => `<span class="text-surface-400 text-xs">${escape(s)}</span>`;
  const previewData = `<span class="rounded bg-surface-100 px-2 py-1 block">${[
    '[{',
    `  исполнитель: "Имя",  ${note('// в мульти-режиме')}`,
    '  баллов_всего: N,',
    '  задач_всего: N,',
    '  корневые_задачи: N,',
    '  коэф_декомпозиции: N,',
    '  средний_балл_за_задачу: N,',
    '  средний_балл_за_мес.: N,',
    '  распределение: "1б: N (N%), 3б: N (N%)",',
    '  топ_задач: ["Название (Nб)"],',
    `  ${note('// при сравнении с предыдущим периодом:')}`,
    '  дельта_баллов: ±N, дельта_задач: ±N,',
    '  дельта_коэф_декомп: ±N, дельта_балл_за_задачу: ±N, ...',
    '}]',
  ].join('\n')}</span>`;

  return buildSystemPrompt(previewData, null, previewContext, periodLabelChip);
}

export function buildSystemPrompt(aiData, dateRange, extraContext = '', periodLabelOverride = null) {
  const [dateFrom, dateTo] = dateRange ?? [];
  const _start = dayjs(dateFrom);
  const _end = dayjs(dateTo);
  const durationDays = (_start.isValid() && _end.isValid()) ? _end.diff(_start, 'day') + 1 : null;
  const periodLabel = periodLabelOverride ?? (dateFrom && dateTo
    ? (durationDays !== null
      ? `${durationDays} ${pluralize(durationDays, ['день', 'дня', 'дней'])} (${formatDate(dateFrom)} — ${formatDate(dateTo)})`
      : `${formatDate(dateFrom)} — ${formatDate(dateTo)}`)
    : (dateFrom ? `с ${formatDate(dateFrom)}` : null));

  const extraSection = extraContext?.trim()
    ? `\nДополнительный контекст:\n${extraContext.trim()}\n`
    : '';

  const prompt = `Ты аналитик продуктивности команды разработки. Тебе предоставлена таблица KPI-метрик по закрытым задачам за период.

Баллы — оценка сложности задачи: чем больше баллов, тем сложнее задача. ${periodLabel ? `\nАнализируемый период: ${periodLabel}` : ''}
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
