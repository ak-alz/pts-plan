import {
  NOTIF_CHANGE_RE,
  NOTIF_CLOSE_RE,
  NOTIF_COMMENT_RE,
  NOTIF_NEW_TASK_RE,
  NOTIF_REACTION_RE,
  TAGALL_PHRASE_RE,
} from '../../patterns.js';

export const NOTIF_TYPES = [
  {
    label: 'Реакция',
    color: '#ec4899',
    re: NOTIF_REACTION_RE,
  },
  {
    label: 'tagall',
    color: '#a855f7',
    re: TAGALL_PHRASE_RE,
  },
  {
    label: 'Комментарий',
    color: '#3b82f6',
    re: NOTIF_COMMENT_RE,
  },
  {
    label: 'Создание',
    color: '#22c55e',
    re: NOTIF_NEW_TASK_RE,
  },
  {
    label: 'Изменение',
    color: '#f97316',
    re: NOTIF_CHANGE_RE,
  },
  {
    label: 'Закрытие',
    color: '#64748b',
    re: NOTIF_CLOSE_RE,
  },
];
