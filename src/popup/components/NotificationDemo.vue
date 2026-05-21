<script setup>
import dayjs from 'dayjs';
import { computed } from 'vue';

import { validateHexColor } from '../../js/utils.js';

const props = defineProps({
  options: {
    type: Object,
    default() {
      return {};
    },
  },
  highlight: {
    type: String,
    default: 'assignee',
  },
});

const keyMap = {
  assignee: {
    border: 'notificationDetailsHighlightBorder',
    bg: 'notificationDetailsHighlightBackground',
  },
  creator: {
    border: 'notificationDetailsHighlightCreatorBorder',
    bg: 'notificationDetailsHighlightCreatorBackground',
  },
  mention: {
    border: 'notificationDetailsHighlightMentionBorder',
    bg: 'notificationDetailsHighlightMentionBackground',
  },
  tagall: {
    border: 'notificationDetailsHighlightTagallBorder',
    bg: 'notificationDetailsHighlightTagallBackground',
  },
};

const borderColor = computed(() => {
  const key = keyMap[props.highlight]?.border;
  const val = props.options[key];
  return validateHexColor(val) ? val : '#e0e0e0';
});

const bgColor = computed(() => {
  const key = keyMap[props.highlight]?.bg;
  const val = props.options[key];
  return validateHexColor(val) ? val : '#ffffff';
});
</script>

<template>
  <div class="notification-demo">
    <div class="notification-demo__header">
      <div class="notification-demo__name">
        Иван Иванов
      </div>
      <span class="notification-demo__chip">В работе</span>
    </div>
    <div class="notification-demo__text">
      Добавил комментарий к задаче <span class="notification-demo__link">[#123456] Реализовать поиск</span> cо следующим текстом
    </div>
    <div class="notification-demo__date">
      {{ dayjs().format('D MMMM HH:mm') }}
    </div>
  </div>
</template>

<style scoped>
.notification-demo {
  position: relative;
  max-width: 210px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid v-bind(borderColor);
  background-color: v-bind(bgColor);
  color: #151515;
}

.notification-demo__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}

.notification-demo__name {
  font-weight: 600;
}

.notification-demo__text {

}

.notification-demo__link {
  color: #0154c8;
  font-weight: 500;
}

.notification-demo__chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f0f0f0;
  font-size: 0.8em;
}

.notification-demo__date {
  position: absolute;
  bottom: 6px;
  right: 10px;
  color: #bcc2c7;
  font-size: 0.8em;
}
</style>
