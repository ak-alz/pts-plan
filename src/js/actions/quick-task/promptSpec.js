import {buildPrompt} from './buildPrompt.js';

export const PROMPT_SPEC = {
  key: 'quick-task-description',
  title: 'описание новой задачи',
  variables: [
    {
      key: 'taskData',
      label: 'Данные задачи',
      description: 'Название, проект, стадия, исполнитель и текущий текст описания (черновик или шаблон)',
    },
    {key: 'extraContext', label: 'Контекст для ИИ'},
  ],
  buildDefault: (values) => buildPrompt(values),
  formatNote: 'Ответ нейросети целиком попадёт в поле «Описание»: просите только текст описания в BBCode, без пояснений.',
};
