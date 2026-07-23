<script setup>
import {computed, onBeforeUnmount, onMounted, ref, toRaw, watch} from 'vue';

import {BROWSER_NOTIFICATION_MESSAGE_TYPE} from '../../messages.js';
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
  DEFAULT_SETTINGS,
  MEETING_STATUS,
  MEETING_TYPE,
  MEETINGS_STORAGE_KEY,
  POLL_INTERVAL_MS,
  PRESENCE_CHANNEL_NAME,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_HELLO_WAIT_MS,
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

// Идентификатор этой вкладки и карта присутствия для выбора ведущей вкладки (см. selectLeaderTabId).
// Карта живёт только в памяти: своя запись обновляется хартбитом, чужие приходят сообщениями
const tabId = crypto.randomUUID();
const presenceMap = ref({});
const presenceChannel = new BroadcastChannel(PRESENCE_CHANNEL_NAME);

// Пересчитывается при изменении карты присутствия (в т.ч. каждый хартбит) — этого достаточно,
// чтобы вовремя заметить смену ведущей вкладки
const isLeaderView = computed(() => selectLeaderTabId(presenceMap.value, Date.now()) === tabId);

// hello — «я открылась, представьтесь» (в ответ каждый шлёт обычное presence), presence — хартбит
function announcePresence(type) {
  const visible = document.visibilityState === 'visible';
  presenceMap.value = {...presenceMap.value, [tabId]: {at: Date.now(), visible}};
  presenceChannel.postMessage({type, tabId, visible});
}

function handlePresenceMessage({data}) {
  // Канал живёт на origin страницы, поэтому теоретически слышен и самому Bitrix — принимаем
  // только сообщения своей формы, чтобы посторонние не влияли на выбор ведущей вкладки
  if (typeof data?.tabId !== 'string' || data.tabId === tabId) return;

  const wasLeader = isLeaderView.value;
  const next = {...presenceMap.value};

  if (data.type === 'bye') {
    delete next[data.tabId];
  } else {
    // Время получения, а не присланное: часы у вкладок общие, но так запись точно не «из будущего»
    next[data.tabId] = {at: Date.now(), visible: !!data.visible};
  }

  presenceMap.value = next;

  if (data.type === 'hello') announcePresence('presence');

  // Прежняя ведущая вкладка закрылась и ведущей стали мы — сразу проверяем, не пора ли показать
  if (!wasLeader && isLeaderView.value) evaluate();
}

// Объявляемся и даём остальным вкладкам мгновение ответить — до этого мы для себя единственные
// живые, а значит и ведущие, и без паузы могли бы задублировать чужое напоминание
async function joinPresence() {
  announcePresence('hello');
  await new Promise((resolve) => setTimeout(resolve, PRESENCE_HELLO_WAIT_MS));
}

function onVisibilityChange() {
  announcePresence('presence');
  if (isLeaderView.value) evaluate();
}

function onPageHide() {
  presenceChannel.postMessage({type: 'bye', tabId});
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
let ringtoneStopTimeoutId = null;

function getAudio() {
  if (!audio) {
    audio = new Audio(chrome.runtime.getURL(RINGTONE_ASSET_PATH));
    audio.loop = true;
  }
  return audio;
}

function clearRingtoneStopTimeout() {
  if (!ringtoneStopTimeoutId) return;
  clearTimeout(ringtoneStopTimeoutId);
  ringtoneStopTimeoutId = null;
}

function stopRingtone() {
  clearRingtoneStopTimeout();
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

  // Модалка при этом остаётся открытой — обрывается только звук, чтобы забытая вкладка
  // не звенела бесконечно, если никто не отреагировал на напоминание
  clearRingtoneStopTimeout();
  const maxMinutes = settings.value.ringtoneMaxMinutes;
  if (maxMinutes > 0) ringtoneStopTimeoutId = setTimeout(stopRingtone, maxMinutes * 60_000);
}

// Не только на смену встречи, но и на сами настройки звука: их могли поменять в другой вкладке
// или на странице настроек прямо пока рингтон играет — тогда он должен смолкнуть (или зазвучать) сразу
watch(
  [activeMeeting, () => settings.value.soundEnabled, () => settings.value.volume],
  playRingtoneIfNeeded,
);

// Выключение звука прямо из модалки — это не разовая заглушка, а настоящая настройка фичи,
// сохраняется в storage и действует для всех будущих напоминаний, пока не включат обратно.
// Сам рингтон останавливает watch выше — по изменившемуся settings.soundEnabled
function toggleMute() {
  settings.value.soundEnabled = !settings.value.soundEnabled;
  chrome.storage.local.set({[SETTINGS_STORAGE_KEY]: toRaw(settings.value)});
}

function sendBrowserNotification(meeting, reminderKey, title) {
  chrome.runtime.sendMessage({
    type: BROWSER_NOTIFICATION_MESSAGE_TYPE,
    dedupeKey: reminderKey,
    title,
    url: meeting.link || window.location.href,
    silent: settings.value.browserNotificationSilent,
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
  // Хост тостов один на всё расширение, поэтому сюда прилетает закрытие любого тоста любой фичи.
  // У чужих тостов id проставляет сам PrimeVue — это счётчик с нуля в каждой вкладке, и без
  // проверки ниже мы бы записали его в свою карту, а другая вкладка по нему закрыла бы
  // собственный посторонний тост с тем же номером. Свои ключи — строки, уже лежащие в shownMap
  if (typeof reminderKey !== 'string' || !shownMap.value[reminderKey]) return;

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
  presenceChannel.addEventListener('message', handlePresenceMessage);
  await joinPresence();
  evaluate();

  pollIntervalId = setInterval(evaluate, POLL_INTERVAL_MS);
  presenceIntervalId = setInterval(() => announcePresence('presence'), PRESENCE_HEARTBEAT_MS);
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
  presenceChannel.close();
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
