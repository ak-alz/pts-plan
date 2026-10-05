import {buildSystemPrompt} from './buildSystemPrompt.js';

export const promptSpec = {
  key: 'decompose-task',
  title: 'декомпозиция задачи',
  variables: [
    {key: 'title', label: 'Название задачи'},
    {key: 'description', label: 'Описание задачи', description: 'Пусто, если в настройках виджета выключено «Описание»'},
    {key: 'extraContext', label: 'Доп. контекст'},
  ],
  buildDefault: (values) => buildSystemPrompt(values.title, values.description, values.extraContext),
  formatNote: 'Виджет ждёт ответ строго JSON-массивом вида [{"title": "…", "description": "…"}] — без этого подзадачи не разберутся.',
};
