import dayjs from 'dayjs';
import {escape} from 'lodash-es';

import {minifyPrompt, pluralize} from '../../utils.js';

const chip = (s) => `<span class="rounded bg-surface-100 dark:bg-surface-800 font-semibold px-1">${escape(s)}</span>`;
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

  const note = (s) => `<span class="text-surface-400 dark:text-surface-500 text-xs">${escape(s)}</span>`;
  const previewData = `<span class="rounded bg-surface-100 dark:bg-surface-800 px-2 py-1 block">${[
    '[{',
    '  исполнитель: "Имя",',
    '  спринтов_в_периоде: N,',
    '  средний_балл: N,',
    '  медианный_балл: N,',
    `  ${note('// при достаточном числе спринтов:')}`,
    '  тренд_начало: N, тренд_конец: N, тренд_дельта: ±N, тренд_процент: "±N%",',
    `  ${note('// при наличии данных предыдущего периода:')}`,
    '  дельта_среднего: ±N, дельта_медианы: ±N,',
    '}, {',
    `  ${note('// итоговая запись, если исполнителей больше одного:')}`,
    '  исполнитель: "ВСЯ КОМАНДА (суммарно за спринт)",',
    '  спринтов_в_периоде: N, исполнителей_в_спринте: N,',
    '  средний_балл: N, медианный_балл: N,',
    '  средний_балл_на_исполнителя: N, средний_балл_при_полном_составе: N,',
    '  всего_баллов_за_период: N,',
    `  ${note('// тренд и дельты — как у исполнителя')}`,
    '}]',
  ].join('\n')}</span>`;

  return buildSystemPrompt(previewData, previewIgnorePoints, null, previewContext, periodLabelChip);
}

// Подпись периода для промпта: «N дней (начало — конец)». Нужна и стандартному промпту, и своим
// шаблонам из библиотеки промптов (переменная period)
export function buildPeriodLabel(dateRange) {
  const [dateFrom, dateTo] = dateRange ?? [];
  const start = dayjs(dateFrom);
  const end = dayjs(dateTo);
  const durationDays = (start.isValid() && end.isValid()) ? end.diff(start, 'day') + 1 : null;
  if (dateFrom && dateTo) {
    return durationDays !== null
      ? `${durationDays} ${pluralize(durationDays, ['день', 'дня', 'дней'])} (${formatDate(dateFrom)} — ${formatDate(dateTo)})`
      : `${formatDate(dateFrom)} — ${formatDate(dateTo)}`;
  }
  return dateFrom ? `с ${formatDate(dateFrom)}` : null;
}

export function buildSystemPrompt(aiData, ignorePoints, dateRange, extraContext = '', periodLabelOverride = null) {
  const periodLabel = periodLabelOverride ?? buildPeriodLabel(dateRange);

  const extraSection = extraContext?.trim()
    ? `\nДополнительный контекст:\n${extraContext.trim()}\n`
    : '';

  const prompt = `Ты аналитик продуктивности команды разработки. Тебе предоставлены данные по спринтам за выбранный период.

Контекст:
- Каждая запись — один исполнитель из команды
- Баллы (story points) отражают сложность выполненных задач в спринте
- Для каждого исполнителя учитываются только спринты, в которых он набрал ≥ ${ignorePoints} баллов — это позволяет исключить спринты с отпуском, больничным или частичной занятостью
- Тренд рассчитан методом линейной регрессии по спринтам периода
- Запись «ВСЯ КОМАНДА» (если она есть) — это суммарные баллы всей команды за спринт: среднее и медиана по ней считаются по этим суммам, а не усреднением личных показателей
- Тренд и дельты команды приведены к полному составу: спринт, в котором кто-то не работал, не занижает их. Поэтому тренд команды может расходиться с суммой личных трендов — сравнивай их осознанно, а не как ошибку${periodLabel ? `\n- Анализируемый период: ${periodLabel}` : ''}
${extraSection}
Дай краткий конструктивный анализ на русском языке:
- Общая продуктивность команды за период
- Если несколько исполнителей — сравни показатели, выдели лидеров и отстающих. Иначе дай индивидуальную оценку
- Тренды: у кого продуктивность растёт или снижается
- Что стоит улучшить или на что обратить внимание

Будь конкретен, избегай общих фраз. Используй markdown: заголовки, списки, выделение. Объём — 150–300 слов.

Данные по спринтам (JSON):
${typeof aiData === 'string' ? aiData : JSON.stringify(aiData)}`;

  return minifyPrompt(prompt);
}
