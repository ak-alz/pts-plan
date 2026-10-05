import {buildSystemPrompt} from './buildSystemPrompt.js';

export const promptSpec = {
  key: 'task-analysis',
  title: 'анализ задач',
  variables: [
    {key: 'data', label: 'Данные', description: 'JSON: KPI по исполнителям — баллы, задачи, декомпозиция, распределение сложности, дельты'},
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
