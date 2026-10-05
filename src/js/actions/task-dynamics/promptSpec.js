import {buildSystemPrompt} from './buildSystemPrompt.js';

export const promptSpec = {
  key: 'task-dynamics',
  title: 'динамика задач',
  variables: [
    {key: 'data', label: 'Данные', description: 'JSON: сводка за период, срез «сейчас», события и помесячные бакеты'},
    {key: 'period', label: 'Период', description: 'Например: 30 дней (01.09.2026 — 30.09.2026)'},
    {key: 'comparePeriod', label: 'Сравнительный период', description: 'Пусто, если сравнение не выбрано'},
    {key: 'extraContext', label: 'Доп. контекст'},
  ],
  buildDefault: (values) => buildSystemPrompt(values.data, {
    extraContext: values.extraContext,
    periodLabelOverride: values.period,
    compareLabelOverride: values.comparePeriod,
  }),
};
