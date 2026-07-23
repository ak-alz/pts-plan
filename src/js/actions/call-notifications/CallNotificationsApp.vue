<script setup>
import {computed, onBeforeUnmount, onMounted, ref, toRaw, watch} from 'vue';

import {onToastClosed, removeToast, showToast} from '../../toastHost/showToast.js';
import CallModal from './components/CallModal.vue';
import {
  evaluateMeetings,
  getReminderKeyFromDismissedKey,
  getReminderTitle,
  getToastDismissedKey,
  isToastDismissedKey,
  selectLeaderTabId,
  toPlainMeetings,
} from './meetingsEngine.js';
import {
  ACTIVE_REMINDERS_STORAGE_KEY,
  BROWSER_NOTIFICATION_MESSAGE_TYPE,
  DEFAULT_SETTINGS,
  MEETING_STATUS,
  MEETING_TYPE,
  MEETINGS_STORAGE_KEY,
  POLL_INTERVAL_MS,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_KEY_PREFIX,
  PRESENCE_TTL_MS,
  RINGTONE_ASSET_PATH,
  SETTINGS_STORAGE_KEY,
  SHOWN_REMINDERS_STORAGE_KEY,
} from './variables.js';

const meetings = ref([]);
const settings = ref({...DEFAULT_SETTINGS});
const shownMap = ref({});
// Общая для всех вкладок очередь активных напоминаний: [{meetingId, remainingMinutes?, elapsedMinutes?}].
// Храним «когда сработало», а не готовую строку — заголовок собираем на лету (не протухает в storage)
const activeReminders = ref([]);

// Идентификатор этой вкладки и её запись присутствия для выбора ведущей вкладки (см. selectLeaderTabId)
const tabId = crypto.randomUUID();
const presenceKey = `${PRESENCE_KEY_PREFIX}${tabId}`;
const presenceMap = ref({});

// Пересчитывается при изменении карты присутствия (в т.ч. каждый хартбит) — этого достаточно,
// чтобы вовремя заметить смену ведущей вкладки
const isLeaderView = computed(() => selectLeaderTabId(presenceMap.value, Date.now()) === tabId);

function writePresence() {
  const entry = {at: Date.now(), visible: document.visibilityState === 'visible'};
  presenceMap.value = {...presenceMap.value, [tabId]: entry};
  chrome.storage.local.set({[presenceKey]: entry});
  // Ведущая вкладка заодно подчищает записи вкладок, закрытых без pagehide (упали/убили процесс)
  if (isLeaderView.value) pruneDeadPresence();
}

function pruneDeadPresence() {
  const now = Date.now();
  const deadKeys = Object.entries(presenceMap.value)
    .filter(([id, entry]) => id !== tabId && now - entry.at >= PRESENCE_TTL_MS)
    .map(([id]) => `${PRESENCE_KEY_PREFIX}${id}`);
  if (deadKeys.length) chrome.storage.local.remove(deadKeys);
}

async function loadPresence() {
  const all = await chrome.storage.local.get(null);
  const map = {};
  Object.entries(all).forEach(([key, value]) => {
    if (key.startsWith(PRESENCE_KEY_PREFIX)) map[key.slice(PRESENCE_KEY_PREFIX.length)] = value;
  });
  presenceMap.value = map;
}

function applyPresenceChanges(changes) {
  const wasLeader = isLeaderView.value;
  const next = {...presenceMap.value};
  Object.entries(changes).forEach(([key, {newValue}]) => {
    if (!key.startsWith(PRESENCE_KEY_PREFIX)) return;
    const id = key.slice(PRESENCE_KEY_PREFIX.length);
    if (newValue) next[id] = newValue;
    else delete next[id];
  });
  presenceMap.value = next;
  // Прежняя ведущая вкладка закрылась и ведущей стали мы — сразу проверяем, не пора ли показать
  if (!wasLeader && isLeaderView.value) evaluate();
}

function onVisibilityChange() {
  writePresence();
  if (isLeaderView.value) evaluate();
}

function onPageHide() {
  chrome.storage.local.remove(presenceKey);
}

// Напоминание в очереди «живо», пока встреча существует и (для разовой) ещё ожидает — так модалка
// сама закроется, если встречу приняли/удалили в другой вкладке или разовая ушла в пропущенные
function isReminderValid(reminder) {
  const meeting = meetings.value.find((item) => item.id === reminder.meetingId);
  if (!meeting) return false;
  return meeting.type !== MEETING_TYPE.ONCE || meeting.status === MEETING_STATUS.PENDING;
}

// Модалку и рингтон показывает только ведущая вкладка, читая общую очередь — при смене ведущей
// напоминание «переезжает» на активную вкладку, а не остаётся звенеть в старой
const activeReminder = computed(() => (isLeaderView.value ? (activeReminders.value.find(isReminderValid) ?? null) : null));
const activeMeeting = computed(() => (activeReminder.value ? (meetings.value.find((meeting) => meeting.id === activeReminder.value.meetingId) ?? null) : null));
const activeReminderTitle = computed(() => (activeMeeting.value ? getReminderTitle(activeMeeting.value, activeReminder.value) : ''));

let audio = null;

function getAudio() {
  if (!audio) {
    audio = new Audio(chrome.runtime.getURL(RINGTONE_ASSET_PATH));
    audio.loop = true;
  }
  return audio;
}

function stopRingtone() {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

function playRingtoneIfNeeded() {
  const shouldPlay = !!activeMeeting.value && settings.value.soundEnabled;

  if (!shouldPlay) {
    stopRingtone();
    return;
  }

  const element = getAudio();
  element.volume = Math.min(1, Math.max(0, settings.value.volume / 100));
  element.play().catch(() => {});
}

watch(activeMeeting, playRingtoneIfNeeded);

// Выключение звука прямо из модалки — это не разовая заглушка, а настоящая настройка фичи,
// сохраняется в storage и действует для всех будущих напоминаний, пока не включат обратно
function toggleMute() {
  settings.value.soundEnabled = !settings.value.soundEnabled;
  chrome.storage.local.set({[SETTINGS_STORAGE_KEY]: toRaw(settings.value)});
  playRingtoneIfNeeded();
}

function sendBrowserNotification(meeting, reminderKey, title) {
  chrome.runtime.sendMessage({
    type: BROWSER_NOTIFICATION_MESSAGE_TYPE,
    dedupeKey: reminderKey,
    title,
    url: meeting.link || window.location.href,
  });
}

// id тоста — это же ключ напоминания (meetingId+offset[+дата]), уникален глобально благодаря
// UUID встречи. Без life — тост не скрывается сам, висит до ручного закрытия (тут это
// осознанное решение, а не забытый таймер)
function showReminderToast(meeting, reminderKey, title) {
  showToast({
    id: reminderKey,
    severity: 'warn',
    summary: title,
    links: meeting.link ? [{url: meeting.link, label: 'Присоединиться'}] : [],
  });
}

// Тост закрыли вручную или он сам скрылся по истечении life — в обоих случаях транслируем
// это в остальные открытые вкладки через shownMap, чтобы там тоже закрылся тот же тост
function handleReminderToastClosed(message) {
  const reminderKey = message?.id;
  if (reminderKey == null) return;

  const dismissedKey = getToastDismissedKey(reminderKey);
  if (shownMap.value[dismissedKey]) return;

  const updated = {...shownMap.value, [dismissedKey]: Date.now()};
  shownMap.value = updated;
  chrome.storage.local.set({[SHOWN_REMINDERS_STORAGE_KEY]: toRaw(updated)});
}

async function loadState() {
  const stored = await chrome.storage.local.get([
    MEETINGS_STORAGE_KEY,
    SETTINGS_STORAGE_KEY,
    SHOWN_REMINDERS_STORAGE_KEY,
    ACTIVE_REMINDERS_STORAGE_KEY,
  ]);
  meetings.value = stored[MEETINGS_STORAGE_KEY] ?? [];
  settings.value = {...DEFAULT_SETTINGS, ...stored[SETTINGS_STORAGE_KEY]};
  shownMap.value = stored[SHOWN_REMINDERS_STORAGE_KEY] ?? {};
  activeReminders.value = stored[ACTIVE_REMINDERS_STORAGE_KEY] ?? [];
}

function persistActiveReminders(next) {
  activeReminders.value = next;
  chrome.storage.local.set({[ACTIVE_REMINDERS_STORAGE_KEY]: toRaw(next)});
}

function evaluate() {
  const result = evaluateMeetings({
    meetings: meetings.value,
    shownMap: shownMap.value,
    settings: settings.value,
    now: new Date(),
  });

  // Показывает и фиксирует напоминание только ведущая вкладка — иначе на нескольких открытых
  // вкладках Bitrix одно напоминание задвоилось бы (рингтон/модалка/тост на каждую)
  if (!isLeaderView.value) return;

  if (result.meetingsChanged) {
    meetings.value = result.updatedMeetings;
    chrome.storage.local.set({[MEETINGS_STORAGE_KEY]: toPlainMeetings(result.updatedMeetings)});
  }

  if (result.shownMapChanged) {
    shownMap.value = result.updatedShownMap;
    chrome.storage.local.set({[SHOWN_REMINDERS_STORAGE_KEY]: toRaw(result.updatedShownMap)});
  }

  // Заодно чистим очередь от протухших встреч (приняты/удалены/пропущены)
  let nextActive = activeReminders.value.filter(isReminderValid);
  let activeChanged = nextActive.length !== activeReminders.value.length;

  result.toShow.forEach(({meeting, reminderKey, remainingMinutes, elapsedMinutes}) => {
    const title = getReminderTitle(meeting, {remainingMinutes, elapsedMinutes});

    if (settings.value.browserNotificationEnabled) sendBrowserNotification(meeting, reminderKey, title);
    if (settings.value.toastEnabled) showReminderToast(meeting, reminderKey, title);

    if (!settings.value.modalEnabled) return;

    const entry = {meetingId: meeting.id, remainingMinutes, elapsedMinutes};
    const index = nextActive.findIndex((reminder) => reminder.meetingId === meeting.id);
    if (index === -1) {
      nextActive = [...nextActive, entry];
      activeChanged = true;
    } else if (nextActive[index].remainingMinutes !== remainingMinutes || nextActive[index].elapsedMinutes !== elapsedMinutes) {
      nextActive = nextActive.map((reminder, i) => (i === index ? entry : reminder));
      activeChanged = true;
    }
  });

  if (activeChanged) persistActiveReminders(nextActive);
}

function removeActiveReminder(meetingId) {
  persistActiveReminders(activeReminders.value.filter((reminder) => reminder.meetingId !== meetingId));
}

function persistMeetingStatus(meetingId, status) {
  const updated = meetings.value.map((meeting) => (meeting.id === meetingId ? {...meeting, status} : meeting));
  meetings.value = updated;
  chrome.storage.local.set({[MEETINGS_STORAGE_KEY]: toPlainMeetings(updated)});
}

function onAccept() {
  const meeting = activeMeeting.value;
  if (!meeting) return;

  if (meeting.link) window.open(meeting.link, '_blank');
  if (meeting.type === MEETING_TYPE.ONCE) persistMeetingStatus(meeting.id, MEETING_STATUS.ACCEPTED);
  removeActiveReminder(meeting.id);
}

function onDismiss() {
  const meeting = activeMeeting.value;
  if (!meeting) return;

  if (meeting.type === MEETING_TYPE.ONCE) persistMeetingStatus(meeting.id, MEETING_STATUS.DISMISSED);
  removeActiveReminder(meeting.id);
}

// Синхронизация между вкладками: чужая запись (принята/отклонена/удалена в другой вкладке —
// например со страницы настроек) убирает встречу из нашей очереди показа, если она там есть
function handleStorageChanged(changes, area) {
  if (area !== 'local') return;

  if (Object.keys(changes).some((key) => key.startsWith(PRESENCE_KEY_PREFIX))) applyPresenceChanges(changes);

  const meetingsChange = changes[MEETINGS_STORAGE_KEY];
  const settingsChange = changes[SETTINGS_STORAGE_KEY];
  const shownChange = changes[SHOWN_REMINDERS_STORAGE_KEY];
  const activeChange = changes[ACTIVE_REMINDERS_STORAGE_KEY];
  if (!meetingsChange && !settingsChange && !shownChange && !activeChange) return;

  if (meetingsChange) meetings.value = meetingsChange.newValue ?? [];
  if (settingsChange) settings.value = {...DEFAULT_SETTINGS, ...settingsChange.newValue};
  if (activeChange) activeReminders.value = activeChange.newValue ?? [];

  if (shownChange) {
    const newShownMap = shownChange.newValue ?? {};
    shownMap.value = newShownMap;

    // Тост закрыли в другой вкладке — закрываем и у себя. removeToast() на уже отсутствующий
    // id — безопасный no-op, поэтому не паримся с диффом относительно предыдущей карты
    Object.keys(newShownMap)
      .filter(isToastDismissedKey)
      .forEach((key) => removeToast(getReminderKeyFromDismissedKey(key)));
  }

  // Встречу добавили/поменяли настройки в другой вкладке (или на странице настроек) — не ждём
  // следующего 30-секундного тика поллинга, перепроверяем сразу
  if (meetingsChange || settingsChange) evaluate();
}

let pollIntervalId = null;
let presenceIntervalId = null;
let unsubscribeToastClosed = null;

onMounted(async () => {
  await loadState();
  await loadPresence();
  writePresence();
  evaluate();

  pollIntervalId = setInterval(evaluate, POLL_INTERVAL_MS);
  presenceIntervalId = setInterval(writePresence, PRESENCE_HEARTBEAT_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  chrome.storage.onChanged.addListener(handleStorageChanged);
  unsubscribeToastClosed = onToastClosed(handleReminderToastClosed);
});

onBeforeUnmount(() => {
  if (pollIntervalId) clearInterval(pollIntervalId);
  if (presenceIntervalId) clearInterval(presenceIntervalId);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('pagehide', onPageHide);
  chrome.storage.onChanged.removeListener(handleStorageChanged);
  unsubscribeToastClosed?.();
  onPageHide();
  stopRingtone();
});
</script>

<template>
  <CallModal
    :meeting="activeMeeting"
    :title="activeReminderTitle"
    :muted="!settings.soundEnabled"
    @accept="onAccept"
    @dismiss="onDismiss"
    @toggle-mute="toggleMute"
  />
</template>
