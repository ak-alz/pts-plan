export const MEETINGS_STORAGE_KEY = 'call-notifications-meetings';
export const SETTINGS_STORAGE_KEY = 'call-notifications-settings';
export const SHOWN_REMINDERS_STORAGE_KEY = 'call-notifications-shown-reminders';
// Очередь активных (показываемых прямо сейчас) напоминаний с модалкой — общая для всех вкладок,
// чтобы окно и рингтон «переезжали» на активную вкладку при смене ведущей, а не висели в старой
export const ACTIVE_REMINDERS_STORAGE_KEY = 'call-notifications-active-reminders';

export const MEETING_TYPE = {
  ONCE: 'once',
  RECURRING: 'recurring',
};

export const MEETING_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DISMISSED: 'dismissed',
  MISSED: 'missed',
};

// «Напоминать за»: два особых значения вместо минут — не напоминать заранее и напомнить ровно
// в момент начала встречи. Вместе с «напоминать после начала» эти два селекта полностью задают
// окно показа: первый — его начало, второй — конец, ничего не срабатывает «само по себе» помимо них
export const REMINDER_DISABLED = -1;
export const REMINDER_AT_START = 0;

export const DEFAULT_SETTINGS = {
  reminderMinutes: REMINDER_AT_START,
  lateReminderMinutes: 10,
  browserNotificationEnabled: true,
  browserNotificationSilent: true,
  toastEnabled: true,
  modalEnabled: false,
  soundEnabled: false,
  volume: 70,
  ringtoneMaxMinutes: 1,
};

export const LATE_REMINDER_MINUTES_OPTIONS = [0, 5, 10, 15, 30];

export const REMINDER_MINUTES_OPTIONS = [REMINDER_DISABLED, REMINDER_AT_START, 1, 2, 3, 5, 10, 15, 30, 45, 60];

export const RINGTONE_MAX_MINUTES_OPTIONS = [1, 2, 3, 5, 10];

export const SHOWN_REMINDERS_MAX_AGE_DAYS = 7;

// Завершённые разовые встречи (принята/отклонена/пропущена) старше этого срока автоматически
// удаляются из списка — иначе история копится бесконечно
export const MEETINGS_MAX_AGE_DAYS = 30;

export const POLL_INTERVAL_MS = 30_000;

// Выбор «ведущей» вкладки: на несколько открытых вкладок Bitrix напоминание показывает только
// одна (приоритет — видимой), чтобы не звенело сразу в нескольких. Вкладки знают друг о друге через
// BroadcastChannel: каждая объявляет о себе на этом интервале и прощается на pagehide. Канал
// выбран вместо chrome.storage: присутствие меняется постоянно, а запись в storage шла бы на диск
// и будила бы всех слушателей storage.onChanged (каждый фрейм Bitrix, попап, «Что нового»).
// Вкладка, не объявлявшаяся дольше TTL, считается мёртвой — так замечаем упавшую (она не успела
// проститься).
// TTL отмерян не в интервалах хартбита, а по дросселированию таймеров: скрытую вкладку Chrome
// будит примерно раз в минуту, поэтому при TTL в несколько интервалов любая фоновая вкладка
// протухала бы в чужих картах, а сама на своём редком пробуждении видела бы протухшими всех
// остальных — и объявляла бы себя единственной живой, то есть ведущей, отбирая напоминание
// у вкладки, где сидит пользователь
export const PRESENCE_CHANNEL_NAME = 'pts-call-notifications-presence';
export const PRESENCE_HEARTBEAT_MS = 5_000;
export const PRESENCE_THROTTLED_HEARTBEAT_MS = 60_000;
export const PRESENCE_TTL_MS = PRESENCE_THROTTLED_HEARTBEAT_MS * 2.5;
// Видимой вкладке длинный TTL не нужен и вреден: её таймеры не дросселируются, она объявляется
// каждые PRESENCE_HEARTBEAT_MS, зато аварийно закрытая (крэш без pagehide) иначе выигрывала бы
// выборы ведущей все 2.5 минуты — и напоминание в это окно не показал бы никто. Четыре пропущенных
// хартбита — уже не занятость главного потока, а мёртвая вкладка
export const PRESENCE_VISIBLE_TTL_MS = PRESENCE_HEARTBEAT_MS * 4;
// Ответы на приветствие приходят сообщениями (асинхронно) — столько ждём, прежде чем первый раз
// решить «я ведущая?», иначе только что открытая вкладка сочтёт себя единственной
export const PRESENCE_HELLO_WAIT_MS = 300;

// Минимальная длина окна показа. Движок не просыпается в точный момент: в фоновой вкладке Chrome
// будит таймеры раз в минуту, а ведущей может оказаться замороженная вкладка — остальные заметят
// это только через PRESENCE_TTL_MS. Окно короче (например, «в момент встречи» без «после начала»)
// проскакивало между пробуждениями, и разовая встреча молча уходила в пропущенные
export const MIN_REMINDER_WINDOW_MS = PRESENCE_TTL_MS + PRESENCE_THROTTLED_HEARTBEAT_MS;

// Индекс = Date.getDay() (0 — воскресенье)
export const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const RINGTONE_ASSET_PATH = 'assets/sounds/ringtone.mp3';
