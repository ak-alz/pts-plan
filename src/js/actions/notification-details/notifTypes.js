import {
  NOTIF_CHANGE_RE,
  NOTIF_CLOSE_RE,
  NOTIF_COMMENT_RE,
  NOTIF_NEW_TASK_RE,
  NOTIF_REACTION_RE,
} from '../../patterns.js';

export const NOTIF_TYPES = [
  {
    label: 'Реакция',
    key: 'reaction',
    color: '#ec4899',
    re: NOTIF_REACTION_RE,
  },
  {
    // Без re: tagall детектится по уже вычисленному isTagall (канонический токен + исключение
    // реакций), а не через общий глобальный TAGALL_WORD_RE — см. renderItem
    label: 'TAGALL',
    key: 'tagall',
    color: '#a855f7',
  },
  {
    label: 'Комментарий',
    key: 'comment',
    color: '#3b82f6',
    re: NOTIF_COMMENT_RE,
  },
  {
    label: 'Создание',
    key: 'new',
    color: '#22c55e',
    re: NOTIF_NEW_TASK_RE,
  },
  {
    label: 'Изменение',
    key: 'change',
    color: '#f97316',
    re: NOTIF_CHANGE_RE,
  },
  {
    label: 'Закрытие',
    key: 'close',
    color: '#64748b',
    re: NOTIF_CLOSE_RE,
  },
];
