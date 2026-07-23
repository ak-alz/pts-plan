<script setup>
import dayjs from 'dayjs';
import {Button, Checkbox, Column, DataTable, Message, MultiSelect, Tag} from 'primevue';
import {useToast} from 'primevue/usetoast';
import {computed, onBeforeUnmount, onMounted, ref, toRaw, watch} from 'vue';

import {toPlainMeetings} from '../../js/actions/call-notifications/meetingsEngine.js';
import {
  DEFAULT_SETTINGS,
  MEETING_STATUS,
  MEETING_TYPE,
  MEETINGS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  WEEKDAY_LABELS,
} from '../../js/actions/call-notifications/variables.js';
import optionsList from '../../js/options.js';
import OptionHint from '../../popup/components/OptionHint.vue';
import CallNotificationsImportExport from './CallNotificationsImportExport.vue';
import CallNotificationsMeetingForm from './CallNotificationsMeetingForm.vue';
import CallNotificationsSettingsForm from './CallNotificationsSettingsForm.vue';

const featureOption = optionsList.find((option) => option.key === 'callNotifications');

const STATUS_FILTER_OPTIONS = [
  {label: 'Ожидание', value: MEETING_STATUS.PENDING},
  {label: 'Пропущенные', value: MEETING_STATUS.MISSED},
  {label: 'Принятые', value: MEETING_STATUS.ACCEPTED},
  {label: 'Отклонённые', value: MEETING_STATUS.DISMISSED},
];

const STATUS_LABELS = {
  [MEETING_STATUS.PENDING]: 'Ожидание',
  [MEETING_STATUS.ACCEPTED]: 'Принята',
  [MEETING_STATUS.DISMISSED]: 'Отклонена',
  [MEETING_STATUS.MISSED]: 'Пропущена',
};

const STATUS_SEVERITIES = {
  [MEETING_STATUS.PENDING]: 'secondary',
  [MEETING_STATUS.ACCEPTED]: 'success',
  [MEETING_STATUS.DISMISSED]: 'secondary',
  [MEETING_STATUS.MISSED]: 'danger',
};

const toast = useToast();

const loaded = ref(false);
const meetings = ref([]);
const settings = ref({...DEFAULT_SETTINGS});
const visibleStatuses = ref([MEETING_STATUS.PENDING, MEETING_STATUS.MISSED]);

const formVisible = ref(false);
const editingMeeting = ref(null);
const deleteConfirmId = ref(null);
const importExportVisible = ref(false);
const settingsVisible = ref(false);

// Страница открывается и через баннер, до того как саму фичу вообще включили в попапе —
// даём включить её прямо здесь, без похода в попап
const featureEnabled = ref(true);
// Решаем один раз при загрузке, а не реактивно — иначе баннер с чекбоксом пропадает
// сразу же по первому клику, не дав увидеть, что галка встала
const showEnableBanner = ref(false);

const featureEnabledModel = computed({
  get: () => featureEnabled.value,
  set: (value) => setFeatureEnabled(value),
});

async function loadFeatureEnabled() {
  const {options} = await chrome.storage.local.get(['options']);
  featureEnabled.value = !!options?.callNotifications;
  showEnableBanner.value = !featureEnabled.value;
}

async function setFeatureEnabled(value) {
  const {options} = await chrome.storage.local.get(['options']);
  await chrome.storage.local.set({options: {...options, callNotifications: value}});
  featureEnabled.value = value;
}

function handleOptionsStorageChanged(changes, area) {
  if (area !== 'local' || !changes.options) return;
  featureEnabled.value = !!changes.options.newValue?.callNotifications;
}

const filteredMeetings = computed(() => meetings.value.filter((meeting) => {
  if (meeting.type !== MEETING_TYPE.ONCE) return true;
  return visibleStatuses.value.includes(meeting.status);
}));

function formatWhen(meeting) {
  if (meeting.type === MEETING_TYPE.ONCE) {
    return dayjs(meeting.dateTime).format('DD.MM.YY, HH:mm');
  }
  const days = [...meeting.daysOfWeek].sort().map((day) => WEEKDAY_LABELS[day]).join(',');
  return `${days} ${meeting.time}`;
}

async function loadState() {
  const stored = await chrome.storage.local.get([MEETINGS_STORAGE_KEY, SETTINGS_STORAGE_KEY]);
  meetings.value = stored[MEETINGS_STORAGE_KEY] ?? [];
  settings.value = {...DEFAULT_SETTINGS, ...stored[SETTINGS_STORAGE_KEY]};
  loaded.value = true;
}

async function persistMeetings() {
  await chrome.storage.local.set({[MEETINGS_STORAGE_KEY]: toPlainMeetings(meetings.value)});
}

watch(settings, () => {
  if (!loaded.value) return;
  chrome.storage.local.set({[SETTINGS_STORAGE_KEY]: toRaw(settings.value)});
}, {deep: true});

function openAddForm() {
  editingMeeting.value = null;
  formVisible.value = true;
}

function openEditForm(meeting) {
  editingMeeting.value = meeting;
  formVisible.value = true;
}

async function onSaveMeeting(meeting) {
  const index = meetings.value.findIndex((item) => item.id === meeting.id);
  meetings.value = index === -1
    ? [...meetings.value, meeting]
    : meetings.value.map((item, i) => (i === index ? meeting : item));
  await persistMeetings();
  toast.add({severity: 'success', summary: index === -1 ? 'Встреча добавлена' : 'Встреча обновлена', life: 3000});
}

async function deleteMeeting(meetingId) {
  meetings.value = meetings.value.filter((item) => item.id !== meetingId);
  deleteConfirmId.value = null;
  await persistMeetings();
  toast.add({severity: 'success', summary: 'Встреча удалена', life: 3000});
}

async function onImported() {
  await loadState();
  toast.add({severity: 'success', summary: 'Импортировано', life: 3000});
}

async function onReset() {
  await loadState();
  toast.add({severity: 'success', summary: 'Настройки сброшены', life: 3000});
}

onMounted(async () => {
  await Promise.all([loadState(), loadFeatureEnabled()]);
  chrome.storage.onChanged.addListener(handleOptionsStorageChanged);
});

onBeforeUnmount(() => {
  chrome.storage.onChanged.removeListener(handleOptionsStorageChanged);
});
</script>

<template>
  <div class="flex flex-col gap-5 w-[720px]">
    <Message
      v-if="showEnableBanner"
      severity="warn"
      :closable="false"
      class="mt-px"
    >
      <div class="flex items-center gap-2">
        <Checkbox
          v-model="featureEnabledModel"
          binary
          input-id="call-notifications-enable-feature"
        />
        <label
          for="call-notifications-enable-feature"
          class="text-sm cursor-pointer"
        >{{ featureOption?.name }}</label>
        <OptionHint
          v-if="featureOption?.tip"
          :tip="featureOption.tip"
          option-key="callNotifications"
        />
      </div>
    </Message>

    <p class="m-0 text-sm text-surface-500 dark:text-surface-400">
      Напоминания о встречах: браузерное уведомление, всплывающее уведомление или окно на сайте,
      со ссылкой на созвон в каждом. У окна можно включить рингтон, но по умолчанию звук выключен и может не
      запуститься без взаимодействия со вкладкой. Способы включаются в настройках. Разовые встречи
      и регулярные (по дням недели) настраиваются ниже.
    </p>

    <div class="flex gap-2">
      <Button
        label="Настройки"
        icon="pi pi-cog"
        severity="secondary"
        outlined
        size="small"
        @click="settingsVisible = true"
      />
      <Button
        label="Импорт / экспорт"
        icon="pi pi-file-export"
        severity="secondary"
        outlined
        size="small"
        @click="importExportVisible = true"
      />
    </div>

    <DataTable
      :value="filteredMeetings"
      data-key="id"
      size="small"
      striped-rows
    >
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <MultiSelect
            v-model="visibleStatuses"
            :options="STATUS_FILTER_OPTIONS"
            option-label="label"
            option-value="value"
            placeholder="Выбрать статус"
            size="small"
            class="w-64"
            :show-toggle-all="false"
          />
          <Button
            label="Добавить встречу"
            icon="pi pi-plus"
            size="small"
            @click="openAddForm"
          />
        </div>
      </template>
      <Column
        field="title"
        header="Название"
      >
        <template #body="{data}">
          <span
            :title="data.title"
            class="block truncate max-w-[240px]"
          >{{ data.title }}</span>
        </template>
      </Column>
      <Column header="Когда">
        <template #body="{data}">
          {{ formatWhen(data) }}
        </template>
      </Column>
      <Column header="Статус">
        <template #body="{data}">
          <Tag
            v-if="data.type === MEETING_TYPE.ONCE"
            :value="STATUS_LABELS[data.status]"
            :severity="STATUS_SEVERITIES[data.status]"
          />
          <Tag
            v-else
            value="Регулярная"
            severity="info"
          />
        </template>
      </Column>
      <Column
        header=""
        style="width: 110px"
      >
        <template #body="{data}">
          <div class="flex gap-1 justify-end">
            <Button
              icon="pi pi-pencil"
              text
              size="small"
              severity="secondary"
              @click="openEditForm(data)"
            />
            <template v-if="deleteConfirmId === data.id">
              <Button
                icon="pi pi-check"
                text
                size="small"
                severity="danger"
                @click="deleteMeeting(data.id)"
              />
              <Button
                icon="pi pi-times"
                text
                size="small"
                severity="secondary"
                @click="deleteConfirmId = null"
              />
            </template>
            <Button
              v-else
              icon="pi pi-trash"
              text
              size="small"
              severity="danger"
              @click="deleteConfirmId = data.id"
            />
          </div>
        </template>
      </Column>
      <template #empty>
        Встреч пока нет
      </template>
    </DataTable>

    <CallNotificationsMeetingForm
      v-model:visible="formVisible"
      :meeting="editingMeeting"
      @save="onSaveMeeting"
    />
    <CallNotificationsImportExport
      v-model:visible="importExportVisible"
      @imported="onImported"
      @reset="onReset"
    />
    <CallNotificationsSettingsForm
      v-model:visible="settingsVisible"
      v-model:settings="settings"
    />
  </div>
</template>
