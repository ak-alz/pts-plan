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

export const DEFAULT_SETTINGS = {
  reminderMinutes: 1,
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

export const REMINDER_MINUTES_OPTIONS = [0, 1, 2, 3, 5, 10, 15, 30, 45, 60];

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
// проститься), поэтому TTL с запасом в несколько интервалов
export const PRESENCE_CHANNEL_NAME = 'pts-call-notifications-presence';
export const PRESENCE_HEARTBEAT_MS = 5_000;
export const PRESENCE_TTL_MS = 15_000;
// Ответы на приветствие приходят сообщениями (асинхронно) — столько ждём, прежде чем первый раз
// решить «я ведущая?», иначе только что открытая вкладка сочтёт себя единственной
export const PRESENCE_HELLO_WAIT_MS = 300;

// Индекс = Date.getDay() (0 — воскресенье)
export const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const RINGTONE_ASSET_PATH = 'assets/sounds/ringtone.mp3';
