<script setup>
import getTaskId from '@/functions/core/getTaskId';
import parseHtml from '@/functions/core/parseHtml';
import { ref } from 'vue';

const props = defineProps({
  bitrixSessionId: {
    type: String,
    required: true,
  },
});

const buttonText = ref('Удалить уведомления задачи');
const isLoading = ref(false);

const onClick = () => {
  const currentTaskId = getTaskId();
  if (!getTaskId) return;

  buttonText.value = 'Поиск уведомлений...';
  isLoading.value = true;

  fetch('/alert/', {
    method: 'GET',
    credentials: 'same-origin',
  })
    .then((res) => res.text())
    .then((html) => {
      const page = parseHtml(html);
      const messages = [...page.querySelectorAll('.message-message')];

      const promises = messages
        .filter((message) => {
          const taskInMessage = message.querySelector('a[href*="/tasks/task/view/"]');
          if (!taskInMessage) return false;

          const taskIDInMessage = getTaskId(taskInMessage.href);

          return taskIDInMessage === currentTaskId;
        })
        .map((message) => {
          const id = message.getAttribute('data-id');

          return fetch('/bitrix/components/bitrix/im.messenger/im.ajax.php?NOTIFY_REMOVE&V=72', {
            method: 'POST',
            credentials: 'same-origin',
            body: `IM_NOTIFY_REMOVE=Y&NOTIFY_ID=${id}&IM_AJAX_CALL=Y&sessid=${props.bitrixSessionId}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          })
            .then((res) => res.text())
            .then(() => id);
        });

      buttonText.value = `Удаление уведомлений (${promises.length})...`;

      Promise.all(promises)
        .then((responses) => {
          window.localStorage.setItem('deletedMessages', responses.join(','));
          isLoading.value = false;
          buttonText.value = `Уведомления удалены (${promises.length})`;
        });
    });
};
</script>

<template>
  <button
    type="button"
    class="delete-all-task-messages-button"
    :disabled="isLoading"
    @click="onClick"
  >
    {{ buttonText }}
  </button>
</template>

<style scoped
       src="./styles.scss"
       lang="scss"
/>
