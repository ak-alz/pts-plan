import {pluralize} from '../../utils.js';
import {
  MEETING_STATUS,
  MEETING_TYPE,
  MEETINGS_MAX_AGE_DAYS,
  PRESENCE_TTL_MS,
  SHOWN_REMINDERS_MAX_AGE_DAYS,
} from './variables.js';

// Массив встреч почти всегда собирается через .map()/.filter() поверх реактивного ref —
// это оставляет вложенные объекты (и их daysOfWeek) Proxy-обёрнутыми даже после toRaw()
// верхнего уровня. JSON-круговорот гарантированно отдаёт полностью плоские данные для записи
export function toPlainMeetings(meetings) {
  return JSON.parse(JSON.stringify(meetings));
}

export function getTriggerWindowStart(triggerTime, offsetMinutes) {
  return triggerTime - offsetMinutes * 60_000;
}

export function isWithinTriggerWindow(triggerTime, now, offsetMinutes) {
  return now >= getTriggerWindowStart(triggerTime, offsetMinutes) && now < triggerTime;
}

// Дедуп-ключ регулярной встречи привязан к календарной дате по местному времени зрителя —
// тот же локальный ориентир, что и время встречи с проверкой дня недели
export function getLocalDateKey(now) {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Регулярная встреча хранит день недели и время в местном часовом поясе зрителя — считаем
// сегодняшний момент по локальному времени (переход на летнее/зимнее время учитывается сам собой)
export function getRecurringTriggerTimeToday(meeting, now) {
  if (!meeting.daysOfWeek?.includes(now.getDay())) return null;

  const [hours, minutes] = meeting.time.split(':').map(Number);
  const trigger = new Date(now);
  trigger.setHours(hours, minutes, 0, 0);
  return trigger.getTime();
}

// Один и тот же дедуп-ключ для once (не повторяется — без даты) и recurring (раз в день — с датой)
export function getReminderShownKey(meetingId, offsetMinutes, dateKey) {
  return dateKey ? `${meetingId}:${offsetMinutes}:${dateKey}` : `${meetingId}:${offsetMinutes}`;
}

// Тост закрывают в конкретной вкладке — сигнал для остальных вкладок пишем в ту же карту
// shownMap (переживает те же чистки), просто под ключом с суффиксом
const TOAST_DISMISSED_SUFFIX = ':closed';

export function getToastDismissedKey(reminderKey) {
  return `${reminderKey}${TOAST_DISMISSED_SUFFIX}`;
}

export function isToastDismissedKey(key) {
  return key.endsWith(TOAST_DISMISSED_SUFFIX);
}

export function getReminderKeyFromDismissedKey(key) {
  return key.slice(0, -TOAST_DISMISSED_SUFFIX.length);
}

export function pruneStaleShownEntries(shownMap, now, maxAgeDays = SHOWN_REMINDERS_MAX_AGE_DAYS) {
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const staleKeys = Object.entries(shownMap)
    .filter(([, shownAt]) => now - shownAt > maxAgeMs)
    .map(([key]) => key);
  if (!staleKeys.length) return shownMap;

  const result = {...shownMap};
  staleKeys.forEach((key) => delete result[key]);
  return result;
}

export function applyMeetingUpdates(meetings, updates) {
  if (!updates.size) return meetings;
  return meetings.map((meeting) => (updates.has(meeting.id) ? {...meeting, ...updates.get(meeting.id)} : meeting));
}

// Завершённые разовые встречи (принята/отклонена/пропущена) старше порога удаляем — регулярные
// и ещё ожидающие разовые не трогаем
export function pruneStaleMeetings(meetings, now, maxAgeDays = MEETINGS_MAX_AGE_DAYS) {
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return meetings.filter((meeting) => {
    if (meeting.type !== MEETING_TYPE.ONCE || meeting.status === MEETING_STATUS.PENDING) return true;
    return now - meeting.dateTime < maxAgeMs;
  });
}

// Выбор «ведущей» вкладки среди живых записей присутствия: приоритет у видимой (на неё смотрит
// пользователь), иначе любая живая; тай-брейк — лексикографически меньший tabId, чтобы все вкладки
// независимо выбрали одну и ту же. Только ведущая показывает напоминание — так на несколько
// открытых вкладок Bitrix приходит один рингтон/модалка/тост, а не по одному на вкладку
export function selectLeaderTabId(presence, now, ttlMs = PRESENCE_TTL_MS) {
  const live = Object.entries(presence).filter(([, entry]) => entry && now - entry.at < ttlMs);
  if (!live.length) return null;
  const visible = live.filter(([, entry]) => entry.visible);
  const pool = visible.length ? visible : live;
  return pool.map(([tabId]) => tabId).sort()[0];
}

// Единая точка входа для одного конкретного момента триггера (разовая встреча или сегодняшнее
// вхождение регулярной): до начала — обычный офсет "напомнить за" (0 — заранее не напоминать);
// после начала и в пределах lateReminderMinutes — один финальный шанс догнать (офсет условно "0"),
// даже если "напомнить за" — "не напоминать" или сам офсет уже не успел сработать
function findReminder(reminderMinutes, triggerTime, nowTime, shownMap, meetingId, graceMs, dateKey) {
  if (nowTime >= triggerTime) {
    if (nowTime >= triggerTime + graceMs) return null;

    const reminderKey = getReminderShownKey(meetingId, 0, dateKey);
    if (shownMap[reminderKey]) return null;

    return {reminderKey, elapsedMinutes: Math.round((nowTime - triggerTime) / 60_000)};
  }

  if (!isWithinTriggerWindow(triggerTime, nowTime, reminderMinutes)) return null;

  const reminderKey = getReminderShownKey(meetingId, reminderMinutes, dateKey);
  if (shownMap[reminderKey]) return null;

  // Фактический остаток до начала, а не настроенный офсет: встречу могли создать уже внутри окна
  // напоминания (например, за 4 минуты при офсете 10) — тогда честнее показать реальные 4 минуты
  return {reminderKey, remainingMinutes: Math.ceil((triggerTime - nowTime) / 60_000)};
}

const MEETING_TYPE_LABELS = {
  [MEETING_TYPE.RECURRING]: 'Регулярная',
  [MEETING_TYPE.ONCE]: 'Разовая',
};

// Когда именно сработало: заранее (remainingMinutes > 0 — фактический остаток до начала),
// прямо в момент начала (elapsedMinutes ~ 0) или позже — "поздний" катч в пределах lateReminderMinutes
function getReminderTiming({remainingMinutes = 0, elapsedMinutes = 0}) {
  if (remainingMinutes > 0) {
    return `через ${remainingMinutes} ${pluralize(remainingMinutes, ['минуту', 'минуты', 'минут'])}`;
  }
  if (!elapsedMinutes) return 'началась';
  return `уже идёт ${elapsedMinutes} ${pluralize(elapsedMinutes, ['минуту', 'минуты', 'минут'])}`;
}

// Единый заголовок напоминания для всех поверхностей (модалка/тост/браузерное): тип + название + когда
// сработало — одно и то же срабатывание выглядит одинаково везде
export function getReminderTitle(meeting, {remainingMinutes, elapsedMinutes}) {
  const typeLabel = MEETING_TYPE_LABELS[meeting.type] ?? MEETING_TYPE_LABELS[MEETING_TYPE.ONCE];
  return `${typeLabel} встреча «${meeting.title}» ${getReminderTiming({remainingMinutes, elapsedMinutes})}`;
}

// Считает, какие встречи нужно показать прямо сейчас, и какие статусы/дедуп-записи обновить.
// Чистая функция без побочных эффектов — вызывающий код сам решает, писать ли в storage.
export function evaluateMeetings({meetings, shownMap, settings, now}) {
  const nowTime = now.getTime();
  const reminderMinutes = settings.reminderMinutes;
  const graceMs = (settings.lateReminderMinutes ?? 0) * 60_000;

  const toShow = [];
  const meetingUpdates = new Map();
  let nextShownMap = shownMap;

  for (const meeting of meetings) {
    if (meeting.type === MEETING_TYPE.ONCE) {
      if (meeting.status !== MEETING_STATUS.PENDING) continue;

      if (nowTime >= meeting.dateTime + graceMs) {
        meetingUpdates.set(meeting.id, {status: MEETING_STATUS.MISSED});
        continue;
      }

      const found = findReminder(reminderMinutes, meeting.dateTime, nowTime, nextShownMap, meeting.id, graceMs);
      if (!found) continue;

      toShow.push({meeting, ...found});
      nextShownMap = {...nextShownMap, [found.reminderKey]: nowTime};
      continue;
    }

    if (meeting.type === MEETING_TYPE.RECURRING) {
      const triggerTime = getRecurringTriggerTimeToday(meeting, now);
      if (triggerTime === null) continue;

      const dateKey = getLocalDateKey(now);
      const found = findReminder(reminderMinutes, triggerTime, nowTime, nextShownMap, meeting.id, graceMs, dateKey);
      if (!found) continue;

      toShow.push({meeting, ...found});
      nextShownMap = {...nextShownMap, [found.reminderKey]: nowTime};
    }
  }

  const prunedShownMap = pruneStaleShownEntries(nextShownMap, nowTime);

  const updatedMeetings = pruneStaleMeetings(applyMeetingUpdates(meetings, meetingUpdates), nowTime);

  return {
    toShow,
    updatedMeetings,
    meetingsChanged: meetingUpdates.size > 0 || updatedMeetings.length !== meetings.length,
    updatedShownMap: prunedShownMap,
    shownMapChanged: prunedShownMap !== shownMap,
  };
}
