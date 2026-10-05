export const MODE = {
  REWRITE: 'rewrite',
  RECOMMEND: 'recommend',
};

export const MODE_OPTIONS = [
  {label: 'Сразу переписать', value: MODE.REWRITE},
  {label: 'Сначала рекомендации и вопросы', value: MODE.RECOMMEND},
];

// Что из задачи, кроме названия и описания (они уходят всегда), отдать нейросети
export const CONTEXT_PARTS = [
  {key: 'status', label: 'Статус и стадия', default: true},
  {key: 'participants', label: 'Постановщик и исполнитель', default: true},
  {key: 'dates', label: 'Даты и сроки', default: true},
  {key: 'comments', label: 'Комментарии', default: true},
  {key: 'subtasks', label: 'Подзадачи', default: true},
  {key: 'parent', label: 'Родительская задача', default: false},
];

export const SETTINGS_STORAGE_KEY = 'improve-description-settings';
export const AI_CONTEXT_MAX_LENGTH = 1000;
// С комментариями и описанием родителя промпт легко выходит за десятки тысяч символов: хвост
// (комментарии идут последними) обрезается, а пользователь получает предупреждение
export const MAX_PROMPT_LENGTH = 40000;

export function getAiContextStorageKey(groupId) {
  return `improve-description-ai-context-${groupId || '0'}`;
}

export function getAiJobStorageKey(taskId, mode) {
  return `improve-description-ai-job-${taskId}-${mode}`;
}

// Старое описание до замены — чтобы откатить его и после того, как окно закрыли
export function getBackupStorageKey(taskId) {
  return `improve-description-backup-${taskId}`;
}
