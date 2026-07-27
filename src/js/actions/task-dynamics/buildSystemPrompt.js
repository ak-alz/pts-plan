import dayjs from 'dayjs';
import {escape} from 'lodash-es';

import {minifyPrompt, pluralize} from '../../utils.js';

const chip = (text) => `<span class="rounded bg-surface-100 dark:bg-surface-800 font-semibold px-1">${escape(text)}</span>`;
const placeholder = (label) => chip(`{ ${label} }`);

function formatDate(date) {
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('DD.MM.YYYY') : String(date);
}

function buildPeriodLabel(dateRange) {
  if (!dateRange?.[0]) return null;
  const days = dayjs(dateRange[1] ?? dateRange[0]).diff(dayjs(dateRange[0]), 'day') + 1;
  return `${days} ${pluralize(days, ['день', 'дня', 'дней'])} (${formatDate(dateRange[0])} — ${formatDate(dateRange[1] ?? dateRange[0])})`;
}

/**
 * Предпросмотр запроса к AI: те же инструкции, но вместо данных — их структура, а подставляемые
 * значения выделены цветом. Показывается в окне «Запрос к AI».
 * @param {[Date, Date]|null} dateRange - Период.
 * @param {[Date, Date]|null} compareDateRange - Сравнительный период.
 * @param {string|null} extraContext - Дополнительный контекст пользователя.
 * @returns {string} HTML-разметка предпросмотра.
 */
export function buildPromptPreview(dateRange, compareDateRange, extraContext) {
  const periodLabelChip = dateRange ? chip(buildPeriodLabel(dateRange)) : placeholder('N дней (начало — конец)');
  const compareLabelChip = compareDateRange
    ? chip(buildPeriodLabel(compareDateRange))
    : placeholder('N дней (начало — конец)');
  const contextChip = extraContext != null ? chip(extraContext) : placeholder('Дополнительный контекст');

  const note = (text) => `<span class="text-surface-400 dark:text-surface-500 text-xs">${escape(text)}</span>`;
  const previewData = `<span class="rounded bg-surface-100 dark:bg-surface-800 px-2 py-1 block">${[
    '{',
    '  период: "01.01.2026 — 30.06.2026",',
    '  сравнительный_период: "01.07.2025 — 31.12.2025",',
    '  разрез: "все задачи" | "только корневые",',
    `  сводка: { "Создано задач": N, "Закрыто задач": N, ... ${note('// и «— дельта» к сравнительному периоду')} },`,
    '  срез_сейчас: { в_планах: N, без_движения_дольше_90_дней: N, взято_в_текущий_спринт: N, ... },',
    '  события: ["2026-05-01: Внедрили AI-агентов"],',
    '  бакеты: [{ бакет: "05.2026", создано: N, закрыто: N, баллы: N, активных_исполнителей: N,',
    '             хотфиксов: N, доля_хотфиксов: N, медиана_времени_дней: N, ... }],',
    `  сравнение_по_событию: { событие: "...", до: { ... }, после: { ... } } ${note('// если событие выбрано')}`,
    '}',
  ].join('\n')}</span>`;

  return buildSystemPrompt(previewData, {
    extraContext: contextChip,
    periodLabelOverride: periodLabelChip,
    compareLabelOverride: compareLabelChip,
  });
}

/**
 * Системный запрос к AI по динамике задач группы. В нём обязательно объяснено, что означают время до
 * закрытия, сколько задача ждёт в планах, и события: без этого модель уверенно пишет выводы про «скорость команды»,
 * которых данные не поддерживают.
 * @param {Object|string} aiData - Данные (объект либо готовая строка для предпросмотра).
 * @param {Object} [options]
 * @param {[Date, Date]|null} [options.dateRange] - Период.
 * @param {[Date, Date]|null} [options.compareDateRange] - Сравнительный период; без него строка не выводится.
 * @param {string} [options.extraContext] - Дополнительный контекст пользователя.
 * @param {string|null} [options.periodLabelOverride] - Готовая подпись периода (для предпросмотра).
 * @param {string|null} [options.compareLabelOverride] - Готовая подпись сравнительного периода (для предпросмотра).
 * @returns {string} Текст запроса.
 */
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
    ? `\nДополнительный контекст от пользователя:\n${extraContext.trim()}\n`
    : '';

  const periodSection = [
    periodLabel ? `Анализируемый период: ${periodLabel}` : null,
    compareLabel ? `Сравнительный период: ${compareLabel}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `Ты аналитик процессов команды разработки. Тебе дана динамика задач одной группы Bitrix24 по месяцам и сводка за период.
${periodSection ? `\n${periodSection}\n` : ''}
Как устроены данные — это важно, без этого выводы будут неверными:
- «Баллы» — оценка сложности задачи, взятая из её названия. Задачи без баллов в названии дают ноль, поэтому смотри на метрику «Задач с баллами в названии»: если покрытие низкое, выводы по баллам слабые.
- «Медиана от постановки до закрытия» — это ПОЛНОЕ время от создания задачи до её закрытия. Внутрь него входит ожидание в планах (месяцы) и ожидание конца спринта, когда задачи закрывают пачкой. Это НЕ скорость работы команды и НЕ время выполнения: метрика меняется в первую очередь от того, как ведут планы и выбирают приоритеты. Никогда не называй её производительностью.
- Данных о том, когда задачу реально взяли в работу, нет вообще — фазы «лежала» и «делали» разделить нечем. Не выдумывай их.
- «Сколько задачи ждут в планах» и «Взято в текущий спринт» — срез на сейчас, а не история: у задачи хранится только текущая колонка канбана, истории переходов нет. Сравнивать срез с бакетами нельзя.
- «Хотфиксы» определяются по названию задачи. Хотфикс в планах почти не лежит, поэтому его медиана времени близка к реальному времени работы, а разрыв с медианой обычных задач — это в основном ожидание в очереди.
- «Задач на корневую» считается плоско, по задачам периода: если родитель закрыт вне периода, его подзадачи посчитаются отдельными корнями. Значение приблизительное.
- «Состав команды» — исполнители выше порога вклада; разовые исполнители в него не входят, поэтому «Баллов на человека» и общий объём работы считаются по разным множествам людей.
- «События» — отмеченные пользователем даты изменений в процессе (найм, смена подхода, внедрение инструментов). Если есть сравнение по событию, оцени, что изменилось после него, но помни: совпадение по времени не доказывает причину, а части периода могут быть разной длины — опирайся на метрики «в месяц», доли и медианы.
- Задачи, перенесённые в другую группу или удалённые, из истории выпадают, поэтому у старых бакетов «создано» может быть занижено.
${extraSection}
Дай разбор на русском языке:
- Входящий поток против пропускной способности: успевает ли команда за потоком задач, растёт ли долг
- Что происходит с выработкой: за счёт роста команды или роста продуктивности
- Качество: доля хотфиксов и её динамика, что это говорит о процессе
- Планы и очередь: что видно из среза «сейчас», есть ли мёртвый груз
- Декомпозиция: мельчает нарезка или крупнеет
- 2–3 конкретных вывода или гипотезы, что стоит проверить или изменить

Будь конкретен, ссылайся на цифры и бакеты. Не делай выводов, которых данные не поддерживают, — если чего-то в данных нет, скажи об этом прямо. Используй markdown: заголовки, списки, выделение. Объём — 250–450 слов.

Данные (JSON):
${typeof aiData === 'string' ? aiData : JSON.stringify(aiData)}`;

  return minifyPrompt(prompt);
}
