<script setup>
import dayjs from 'dayjs';
import {Button, DatePicker, Dialog, InputMask, InputText, Message, MultiSelect, SelectButton} from 'primevue';
import {computed, reactive, watch} from 'vue';

import {MEETING_STATUS, MEETING_TYPE, WEEKDAY_LABELS} from '../../js/actions/call-notifications/variables.js';
import FormField from '../../js/ui/FormField.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  meeting: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:visible', 'save']);

const TYPE_OPTIONS = [
  {label: 'Разовая', value: MEETING_TYPE.ONCE},
  {label: 'Регулярная', value: MEETING_TYPE.RECURRING},
];

// Пн-Вс для UI, хотя WEEKDAY_LABELS индексируется под Date.getDay() (0 — воскресенье)
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0].map((value) => ({label: WEEKDAY_LABELS[value], value}));

const DEFAULT_TIME = '12:00';
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5]; // Пн-Пт

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Дата и время встречи трактуются в местном часовом поясе браузера — так у каждого «10:00»
// означает 10:00 по его времени
function localDateToday() {
  return dayjs().startOf('day').toDate();
}

const form = reactive({
  type: MEETING_TYPE.ONCE,
  title: '',
  link: '',
  date: null,
  time: DEFAULT_TIME,
  daysOfWeek: [],
});

function resetForm() {
  const {meeting} = props;
  form.type = meeting?.type ?? MEETING_TYPE.ONCE;
  form.title = meeting?.title ?? '';
  form.link = meeting?.link ?? '';
  form.daysOfWeek = Array.isArray(meeting?.daysOfWeek) ? [...meeting.daysOfWeek] : [...DEFAULT_WEEKDAYS];

  if (meeting?.dateTime) {
    const moment = dayjs(meeting.dateTime);
    form.date = moment.startOf('day').toDate();
    form.time = moment.format('HH:mm');
  } else {
    form.date = localDateToday();
    form.time = meeting?.time ?? DEFAULT_TIME;
  }
}

watch(() => props.visible, (value) => {
  if (value) resetForm();
});

const titlePlaceholder = computed(() => (form.type === MEETING_TYPE.ONCE ? 'Например, Созвон с клиентом' : 'Например, Дейли'));

const isLinkValid = computed(() => !form.link.trim() || isValidHttpUrl(form.link.trim()));

// Маска гарантирует только цифры на своих местах — часы/минуты в допустимом диапазоне проверяем сами
const isTimeFilled = computed(() => !form.time.includes('_'));
const isTimeValid = computed(() => isTimeFilled.value && /^([01]\d|2[0-3]):[0-5]\d$/.test(form.time));

const isValid = computed(() => {
  if (!form.title.trim() || !isLinkValid.value || !isTimeValid.value) return false;
  if (form.type === MEETING_TYPE.ONCE) return !!form.date;
  return form.daysOfWeek.length > 0;
});

// Выбранный день + введённое время трактуются в местном часовом поясе браузера
function combineDateAndTime(date, timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return dayjs(date).hour(hours).minute(minutes).second(0).millisecond(0).valueOf();
}

function onSubmit() {
  const base = {
    id: props.meeting?.id ?? crypto.randomUUID(),
    type: form.type,
    title: form.title.trim(),
    link: form.link.trim(),
  };

  const meeting = form.type === MEETING_TYPE.ONCE
    ? {...base, dateTime: combineDateAndTime(form.date, form.time), status: MEETING_STATUS.PENDING}
    : {...base, daysOfWeek: [...form.daysOfWeek].sort(), time: form.time};

  emit('save', meeting);
  emit('update:visible', false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="meeting ? 'Редактировать встречу' : 'Добавить встречу'"
    modal
    dismissable-mask
    :draggable="false"
    :style="{width: '620px'}"
    @update:visible="(value) => emit('update:visible', value)"
  >
    <form
      class="flex flex-col gap-3"
      @submit.prevent="onSubmit"
    >
      <div class="grid grid-cols-2 gap-3">
        <FormField label="Тип встречи">
          <SelectButton
            v-model="form.type"
            fluid
            :options="TYPE_OPTIONS"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            size="small"
          />
        </FormField>

        <div />

        <FormField label="Название *">
          <InputText
            v-model="form.title"
            size="small"
            class="w-full"
            :placeholder="titlePlaceholder"
          />
        </FormField>

        <FormField label="Ссылка на созвон">
          <InputText
            v-model="form.link"
            size="small"
            class="w-full"
            placeholder="https://... (необязательно)"
            :invalid="!isLinkValid"
          />
          <Message
            v-if="!isLinkValid"
            severity="error"
            size="small"
            variant="simple"
          >
            Похоже, это не ссылка
          </Message>
        </FormField>

        <FormField
          v-if="form.type === MEETING_TYPE.ONCE"
          label="Дата *"
        >
          <DatePicker
            v-model="form.date"
            date-format="dd.mm.y"
            show-icon
            icon-display="input"
            placeholder="Выберите дату"
            size="small"
            fluid
          />
        </FormField>

        <FormField
          v-else
          label="Дни недели *"
        >
          <MultiSelect
            v-model="form.daysOfWeek"
            :options="DAY_OPTIONS"
            option-label="label"
            option-value="value"
            placeholder="Выберите дни"
            size="small"
            class="w-full"
          />
        </FormField>

        <FormField
          label="Время *"
          tip="По вашему местному часовому поясу — напоминание сработает в это же время на ваших часах."
        >
          <InputMask
            v-model="form.time"
            mask="99:99"
            placeholder="ЧЧ:ММ"
            size="small"
            fluid
          />
          <Message
            v-if="isTimeFilled && !isTimeValid"
            severity="error"
            size="small"
            variant="simple"
          >
            Похоже, это не время
          </Message>
        </FormField>
      </div>

      <Button
        type="submit"
        label="Сохранить"
        size="small"
        class="self-start"
        :disabled="!isValid"
      />
    </form>
  </Dialog>
</template>
