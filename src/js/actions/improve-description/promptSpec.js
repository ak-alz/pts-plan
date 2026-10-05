import {buildPrompt} from './buildPrompt.js';
import {MODE} from './variables.js';

const TASK_DATA_VARIABLE = {
  key: 'taskData',
  label: 'Данные задачи',
  description: 'Название, текущее описание и всё, что отмечено галками «Что передать нейросети»',
};
const EXTRA_CONTEXT_VARIABLE = {key: 'extraContext', label: 'Доп. контекст'};

export const PROMPT_SPECS = {
  [MODE.REWRITE]: {
    key: 'improve-description-rewrite',
    title: 'новое описание задачи',
    variables: [
      TASK_DATA_VARIABLE,
      EXTRA_CONTEXT_VARIABLE,
      {
        key: 'recommendationsSection',
        label: 'Рекомендации и ответы',
        description: 'Рекомендации нейросети и ваши ответы на вопросы — только на втором шаге режима рекомендаций, иначе пусто',
      },
    ],
    buildDefault: (values) => buildPrompt({mode: MODE.REWRITE, ...values}),
    formatNote: 'Ответ нейросети целиком станет новым описанием задачи: просите только текст описания в BBCode, без пояснений, и чтобы ссылки, [USER=…] и вставленные файлы [DISK FILE ID=…] остались на месте.',
  },
  [MODE.RECOMMEND]: {
    key: 'improve-description-recommend',
    title: 'рекомендации по описанию задачи',
    variables: [TASK_DATA_VARIABLE, EXTRA_CONTEXT_VARIABLE],
    buildDefault: (values) => buildPrompt({mode: MODE.RECOMMEND, ...values}),
    formatNote: 'Ответ показывается как Markdown и затем передаётся в промпт нового описания вместе с вашими ответами.',
  },
};
