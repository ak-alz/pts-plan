import dayjs from 'dayjs';
import {escape} from 'lodash-es';

import {minifyPrompt, pluralize} from '../../utils.js';

const chip = (s) => `<span class="rounded bg-surface-100 font-semibold px-1">${escape(s)}</span>`;
const v = (label) => chip(`{ ${label} }`);

function formatDate(d) {
  const parsed = dayjs(d);
  return parsed.isValid() ? parsed.format('DD.MM.YYYY') : String(d);
}

export function buildPromptPreview(ignorePoints, dateRange, extraContext) {
  const rawDays = dateRange ? dayjs(dateRange[1]).diff(dayjs(dateRange[0]), 'day') + 1 : null;
  const previewIgnorePoints = ignorePoints != null ? chip(String(ignorePoints)) : v('Порог баллов');
  const periodLabelChip = dateRange
    ? chip(`${rawDays} ${pluralize(rawDays, ['день', 'дня', 'дней'])} (${formatDate(dateRange[0])} — ${formatDate(dateRange[1])})`)
    : v('N дней (начало — конец)');
  const previewContext = extraContext != null ? chip(extraContext) : v('Доп. контекст');

  const note = (s) => `<span class="text-surface-400 text-xs">${escape(s)}</span>`;
  const previewData = `<span class="rounded bg-surface-100 px-2 py-1 block">${[
    '[{',
    '  участник: "Имя",',
    '  спринтов_в_периоде: N,',
    '  средний_балл: N,',
    '  медианный_балл: N,',
    `  ${note('// при достаточном числе спринтов:')}`,
    '  тренд_начало: N, тренд_конец: N, тренд_дельта: ±N, тренд_процент: "±N%",',
    `  ${note('// при наличии данных предыдущего периода:')}`,
    '  дельта_среднего: ±N, дельта_медианы: ±N,',
    '}]',
  ].join('\n')}</span>`;

  return buildSystemPrompt(previewData, previewIgnorePoints, null, previewContext, periodLabelChip);
}

export function buildSystemPrompt(aiData, ignorePoints, dateRange, extraContext = '', periodLabelOverride = null) {
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

  const prompt = `Ты аналитик продуктивности команды разработки. Тебе предоставлены данные по спринтам за выбранный период.

Контекст:
- Каждая запись — один участник команды
- Баллы (story points) отражают сложность выполненных задач в спринте
- Для каждого участника учитываются только спринты, в которых он набрал ≥ ${ignorePoints} баллов — это позволяет исключить спринты с отпуском, больничным или частичной занятостью
- Тренд рассчитан методом линейной регрессии по спринтам периода${periodLabel ? `\n- Анализируемый период: ${periodLabel}` : ''}
${extraSection}
Дай краткий конструктивный анализ на русском языке:
- Общая продуктивность команды за период
- Если несколько участников — сравни показатели, выдели лидеров и отстающих. Иначе дай индивидуальную оценку
- Тренды: у кого продуктивность растёт или снижается
- Что стоит улучшить или на что обратить внимание

Будь конкретен, избегай общих фраз. Используй markdown: заголовки, списки, выделение. Объём — 150–300 слов.

Данные по спринтам (JSON):
${typeof aiData === 'string' ? aiData : JSON.stringify(aiData)}`;

  return minifyPrompt(prompt);
}
