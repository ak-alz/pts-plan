import {buildPrompt} from './buildPrompt.js';
import {ANSWERS_PROMPT, MODE} from './variables.js';

const TASK_DATA_VARIABLE = {
  key: 'taskData',
  label: 'Данные задачи',
  description: 'Название, текущее описание и всё, что отмечено галками «Что передать нейросети»',
};
const EXTRA_CONTEXT_VARIABLE = {key: 'extraContext', label: 'Доп. контекст'};
const REWRITE_FORMAT_NOTE = 'Ответ нейросети целиком станет новым описанием задачи: просите только текст описания в BBCode, без пояснений, и чтобы ссылки, [USER=…] и вставленные файлы [DISK FILE ID=…] остались на месте.';

// У каждого шага своя библиотека: «сразу новое описание», рекомендации и новое описание по ответам
// на рекомендации — действия разные, и промпты под них пишут разные
export const PROMPT_SPECS = {
  [MODE.REWRITE]: {
    key: 'improve-description-rewrite',
    title: 'новое описание задачи',
    variables: [TASK_DATA_VARIABLE, EXTRA_CONTEXT_VARIABLE],
    buildDefault: (values) => buildPrompt({mode: MODE.REWRITE, ...values}),
    formatNote: REWRITE_FORMAT_NOTE,
  },
  [MODE.RECOMMEND]: {
    key: 'improve-description-recommend',
    title: 'рекомендации по описанию задачи',
    variables: [TASK_DATA_VARIABLE, EXTRA_CONTEXT_VARIABLE],
    buildDefault: (values) => buildPrompt({mode: MODE.RECOMMEND, ...values}),
    formatNote: 'Ответ показывается как Markdown и затем передаётся в промпт нового описания вместе с вашими ответами.',
  },
  [ANSWERS_PROMPT]: {
    key: 'improve-description-answers',
    title: 'новое описание по рекомендациям и ответам',
    variables: [
      TASK_DATA_VARIABLE,
      EXTRA_CONTEXT_VARIABLE,
      {
        key: 'recommendationsSection',
        label: 'Рекомендации и ответы',
        description: 'Рекомендации и вопросы с первого шага и ваши ответы на них',
      },
    ],
    buildDefault: (values) => buildPrompt({mode: MODE.REWRITE, ...values}),
    formatNote: REWRITE_FORMAT_NOTE,
  },
};
