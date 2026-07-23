import {MEETING_TIME_RE} from '../../patterns.js';
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

// Дедуп-ключ регулярной встречи привязан к календарной дате её вхождения по местному времени
// зрителя — тот же локальный ориентир, что и время встречи с проверкой дня недели
export function getLocalDateKey(date) {
  const localDate = new Date(date);
  return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
}

// Вчера/сегодня/завтра: окно «напомнить за N минут» у встречи в первые часы суток начинается ещё
// в предыдущий день, а «поздний» катч у поздневечерней — дотягивается в следующий, поэтому одного
// сегодняшнего вхождения недостаточно. Окна разных вхождений пересечься не могут — между ними сутки
const TRIGGER_DAY_OFFSETS = [-1, 0, 1];

// Регулярная встреча хранит день недели и время в местном часовом поясе зрителя — вхождения
// считаем нативным Date по локальному времени (переход на летнее/зимнее время учитывается сам
// собой). День недели проверяется у каждого дня-кандидата, а dateKey привязан к дате самого
// вхождения, а не к моменту показа: иначе одно кросс-полуночное напоминание получило бы два
// разных дедуп-ключа (до и после полуночи) и всплыло бы дважды
export function getRecurringTriggers(meeting, now) {
  const [hours, minutes] = meeting.time.split(':').map(Number);

  return TRIGGER_DAY_OFFSETS.map((dayOffset) => {
    const trigger = new Date(now);
    trigger.setDate(trigger.getDate() + dayOffset);
    if (!meeting.daysOfWeek?.includes(trigger.getDay())) return null;

    trigger.setHours(hours, minutes, 0, 0);
    return {triggerTime: trigger.getTime(), dateKey: getLocalDateKey(trigger)};
  }).filter(Boolean);
}

// Один слот на встречу (для once — без даты, для recurring — раз в день, с датой), общий для
// обоих триггеров в findReminder (заранее и "поздний" в момент начала) — какой бы из них ни
// сработал первым, он же блокирует второй, иначе принятое заранее напоминание всплывает повторно
// ровно в момент начала встречи
export function getReminderShownKey(meetingId, dateKey) {
  return dateKey ? `${meetingId}:${dateKey}` : `${meetingId}`;
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

const MEETING_STATUSES = Object.values(MEETING_STATUS);

// Одна встреча из внешнего JSON (импорт) → встреча рабочего формата, либо null, если запись
// непригодна. Проверяем ровно то, на что опирается движок и таблица: без времени/даты встреча
// никогда не сработает, а без типа её не отфильтровать и не почистить — такая осела бы в списке
// навсегда. id и статус при этом достраиваем: их можно восстановить без потери смысла
function normalizeImportedMeeting(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  const base = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    title,
    link: typeof raw.link === 'string' ? raw.link.trim() : '',
  };

  if (raw.type === MEETING_TYPE.ONCE) {
    const dateTime = Number(raw.dateTime);
    if (!Number.isFinite(dateTime) || dateTime <= 0) return null;

    return {
      ...base,
      type: MEETING_TYPE.ONCE,
      dateTime,
      status: MEETING_STATUSES.includes(raw.status) ? raw.status : MEETING_STATUS.PENDING,
    };
  }

  if (raw.type === MEETING_TYPE.RECURRING) {
    if (typeof raw.time !== 'string' || !MEETING_TIME_RE.test(raw.time)) return null;

    const daysOfWeek = Array.isArray(raw.daysOfWeek)
      ? [...new Set(raw.daysOfWeek.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
      : [];
    if (!daysOfWeek.length) return null;

    return {...base, type: MEETING_TYPE.RECURRING, time: raw.time, daysOfWeek};
  }

  return null;
}

/**
 * Разбирает импортированный список встреч, отбрасывая непригодные записи.
 * @param {unknown} rawMeetings - Значение поля `meetings` из вставленного пользователем JSON.
 * @returns {{meetings: object[], skipped: number}} Пригодные встречи и число отброшенных записей.
 */
export function normalizeImportedMeetings(rawMeetings) {
  if (!Array.isArray(rawMeetings)) return {meetings: [], skipped: 0};

  const meetings = rawMeetings.map(normalizeImportedMeeting).filter(Boolean);
  return {meetings, skipped: rawMeetings.length - meetings.length};
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

    const reminderKey = getReminderShownKey(meetingId, dateKey);
    if (shownMap[reminderKey]) return null;

    return {reminderKey, elapsedMinutes: Math.round((nowTime - triggerTime) / 60_000)};
  }

  if (!isWithinTriggerWindow(triggerTime, nowTime, reminderMinutes)) return null;

  const reminderKey = getReminderShownKey(meetingId, dateKey);
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
      for (const {triggerTime, dateKey} of getRecurringTriggers(meeting, now)) {
        const found = findReminder(reminderMinutes, triggerTime, nowTime, nextShownMap, meeting.id, graceMs, dateKey);
        if (!found) continue;

        toShow.push({meeting, ...found});
        nextShownMap = {...nextShownMap, [found.reminderKey]: nowTime};
      }
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
