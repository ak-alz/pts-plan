import {buildSystemPrompt} from './buildSystemPrompt.js';

export const promptSpec = {
  key: 'scrum-summary',
  title: 'сводка по итогам спринтов',
  variables: [
    {key: 'data', label: 'Данные по спринтам', description: 'JSON: по каждому исполнителю и по всей команде — средний и медианный балл, тренд, дельты'},
    {key: 'period', label: 'Период', description: 'Например: 28 дней (01.09.2026 — 28.09.2026)'},
    {key: 'ignorePoints', label: 'Порог баллов', description: 'Спринты, где исполнитель набрал меньше, не учитываются'},
    {key: 'extraContext', label: 'Доп. контекст'},
  ],
  buildDefault: (values) => buildSystemPrompt(values.data, values.ignorePoints, null, values.extraContext, values.period),
};
