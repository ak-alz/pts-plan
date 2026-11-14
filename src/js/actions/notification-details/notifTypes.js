import {
  NOTIF_CHANGE_RE,
  NOTIF_CLOSE_RE,
  NOTIF_COMMENT_RE,
  NOTIF_CRM_RE,
  NOTIF_DEADLINE_RE,
  NOTIF_DELETE_RE,
  NOTIF_DISK_RE,
  NOTIF_FEEDBACK_RE,
  NOTIF_GROUP_RE,
  NOTIF_NEW_TASK_RE,
  NOTIF_OFFER_RE,
  NOTIF_REACTION_RE,
  NOTIF_REMINDER_RE,
  NOTIF_SURVEY_RE,
} from '../../patterns.js';
import {getNotificationEvent, NOTIFICATION_EVENT_KEYS} from '../../utils.js';

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
  {
    label: 'Удаление',
    key: 'delete',
    color: '#ef4444',
    re: NOTIF_DELETE_RE,
  },
  {
    label: 'Группа',
    key: 'group',
    color: '#14b8a6',
    re: NOTIF_GROUP_RE,
  },
  {
    label: 'Диск',
    key: 'disk',
    color: '#eab308',
    re: NOTIF_DISK_RE,
  },
  {
    label: 'Дедлайн',
    key: 'deadline',
    color: '#f43f5e',
    re: NOTIF_DEADLINE_RE,
  },
  {
    label: 'Напоминание',
    key: 'reminder',
    color: '#0ea5e9',
    re: NOTIF_REMINDER_RE,
  },
  {
    label: 'Обратная связь',
    key: 'feedback',
    color: '#84cc16',
    re: NOTIF_FEEDBACK_RE,
  },
  {
    label: 'CRM',
    key: 'crm',
    color: '#6366f1',
    re: NOTIF_CRM_RE,
  },
  {
    label: 'Оффер',
    key: 'offer',
    color: '#06b6d4',
    re: NOTIF_OFFER_RE,
  },
  {
    label: 'Опрос',
    key: 'survey',
    color: '#d946ef',
    re: NOTIF_SURVEY_RE,
  },
];

/**
 * Подбирает типы уведомления по его тексту. У уведомления о событии задачи (комментарий, реакция,
 * создание, изменение, закрытие, удаление) тип один — само событие: всё, что идёт после фразы
 * события, написано людьми, и «закрыл задачу» или «потерян лид» в тексте комментария типом не считается.
 * И наоборот: у уведомления не о событии (сводка дедлайнов, обратная связь, CRM) типом события не
 * становятся слова из названия задачи или текста отзыва.
 * @param {string} text - Канонизированный текст уведомления (tagall-фраза заменена на токен).
 * @param {boolean} [isTagall=false] - Уведомление адресовано всем участникам (вычисляется снаружи).
 * @returns {Array<{label: string, key: string, color: string}>} Совпавшие записи `NOTIF_TYPES`.
 */
export function matchNotifTypes(text, isTagall = false) {
  const event = getNotificationEvent(text);

  return NOTIF_TYPES.filter(({key, re}) => {
    if (key === 'tagall') return isTagall;
    if (NOTIFICATION_EVENT_KEYS.includes(key)) return key === event;
    return !event && re.test(text);
  });
}
