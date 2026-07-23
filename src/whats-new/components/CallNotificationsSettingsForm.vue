<script setup>
import {Dialog, InputNumber, Select, Slider, ToggleSwitch} from 'primevue';

import {LATE_REMINDER_MINUTES_OPTIONS, REMINDER_MINUTES_OPTIONS} from '../../js/actions/call-notifications/variables.js';
import FormField from '../../js/ui/FormField.vue';

const visible = defineModel('visible', {type: Boolean, required: true});
const settings = defineModel('settings', {type: Object, required: true});

const REMINDER_OPTIONS = REMINDER_MINUTES_OPTIONS.map((minutes) => ({
  label: minutes === 0 ? 'Не напоминать' : `${minutes} мин`,
  value: minutes,
}));
const LATE_REMINDER_OPTIONS = LATE_REMINDER_MINUTES_OPTIONS.map((minutes) => ({
  label: minutes === 0 ? 'Не напоминать' : `${minutes} мин`,
  value: minutes,
}));
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="Настройки уведомлений о встречах"
    modal
    dismissable-mask
    :draggable="false"
    :style="{width: '420px'}"
  >
    <div class="flex flex-col gap-4">
      <FormField
        label="Напоминать за"
        tip="«Не напоминать» — заранее не напомнит, но сработает разовый шанс догнать в момент начала встречи (см. ниже)."
      >
        <Select
          v-model="settings.reminderMinutes"
          :options="REMINDER_OPTIONS"
          option-label="label"
          option-value="value"
          size="small"
          class="w-full"
        />
      </FormField>
      <FormField
        label="Ещё напоминать после начала"
        tip="Если не успели среагировать до начала встречи — даёт ещё один шанс напомнить в течение этого времени после старта. «Не напоминать» — сразу считать пропущенной."
      >
        <Select
          v-model="settings.lateReminderMinutes"
          :options="LATE_REMINDER_OPTIONS"
          option-label="label"
          option-value="value"
          size="small"
          class="w-full"
        />
      </FormField>
      <div class="flex items-center gap-2">
        <ToggleSwitch
          v-model="settings.browserNotificationEnabled"
          input-id="call-notifications-browser"
          size="small"
        />
        <label
          for="call-notifications-browser"
          class="text-sm cursor-pointer"
        >Браузерное уведомление</label>
        <i
          v-tooltip="'Браузерное уведомление — придёт, даже когда вкладка Bitrix свёрнута или в фоне. Работает, пока вкладка открыта хотя бы в фоне: если закрыть все вкладки Bitrix, напоминаний не будет.'"
          class="pi pi-question-circle text-surface-500 dark:text-surface-400 text-xs"
        />
      </div>
      <div class="flex items-center gap-2">
        <ToggleSwitch
          v-model="settings.toastEnabled"
          input-id="call-notifications-toast"
          size="small"
        />
        <label
          for="call-notifications-toast"
          class="text-sm cursor-pointer"
        >Всплывающее уведомление</label>
        <i
          v-tooltip="'Всплывает в углу страницы со ссылкой на созвон — тише, чем окно с рингтоном. Висит, пока не закроете.'"
          class="pi pi-question-circle text-surface-500 dark:text-surface-400 text-xs"
        />
      </div>
      <div class="flex items-center gap-2">
        <ToggleSwitch
          v-model="settings.modalEnabled"
          input-id="call-notifications-modal"
          size="small"
        />
        <label
          for="call-notifications-modal"
          class="text-sm cursor-pointer"
        >Показывать всплывающее окно на сайте</label>
      </div>
      <template v-if="settings.modalEnabled">
        <div class="flex items-center gap-2">
          <ToggleSwitch
            v-model="settings.soundEnabled"
            input-id="call-notifications-sound"
            size="small"
          />
          <label
            for="call-notifications-sound"
            class="text-sm cursor-pointer"
          >Звук</label>
          <i
            v-tooltip="'Рингтон в окне может не запуститься автоматически, если вы ещё не взаимодействовали со вкладкой Bitrix (клик, скролл) — браузер блокирует автовоспроизведение звука. Тогда сработают окно и остальные уведомления, но без звука.'"
            class="pi pi-question-circle text-surface-500 dark:text-surface-400 text-xs"
          />
        </div>
        <FormField
          v-if="settings.soundEnabled"
          label="Громкость"
        >
          <div class="flex items-center gap-3">
            <Slider
              v-model="settings.volume"
              class="grow"
            />
            <InputNumber
              v-model="settings.volume"
              size="small"
              suffix="%"
              :min="0"
              :max="100"
              :input-style="{width: '60px'}"
            />
          </div>
        </FormField>
      </template>
    </div>
  </Dialog>
</template>
