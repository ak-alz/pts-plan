// добавляет кнопку для удаления всех уведомлений текущей задачи
// FIXME: deletedMessages криво записывается
export default function addDelAllTaskMessages() {
  if (!location.href.includes('/task/view/') || document.querySelector('span.delete-messages-alert')) return false;
  const delMessagesLink = document.createElement('span');
  delMessagesLink.className = 'delete-messages-alert';
  delMessagesLink.style = 'color: #a8aeb5; font-size: 13px; display: block; cursor: pointer;';
  delMessagesLink.innerText = 'Удалить уведомления задачи';
  const likeBlock = document.querySelector('div.task-detail-like');
  if (likeBlock) likeBlock.appendChild(delMessagesLink);

  async function getUrl(url, options) {
    const response = await fetch(url, options);
    const data = await response.text();
    return data;
  }

  delMessagesLink.addEventListener('click', () => {
    getUrl('https://plan.pixelplus.ru/alert/', {method: 'GET', credentials: 'same-origin'})
      .then((code) => {
        const deletedMessages = [];
        const re = /\/tasks\/task\/view\/(\d+?)\/.*/i;
        const currentTaskId = re.exec(location.href)[1];
        const parser = new DOMParser();
        const alertCode = parser.parseFromString(code, 'text/html');
        const messages = [...alertCode.querySelectorAll('div.message-item div.message-message')];
        messages.forEach((message) => {
          const taskInMessage = message.querySelector('a[href*="/task/view/"]');
          if (!taskInMessage) return false;
          const taskIDInMessage = re.exec(taskInMessage.href)[1];
          if (taskIDInMessage !== currentTaskId) return false;
          const NOTIFY_ID = message.getAttribute('data-id');
          getUrl('https://plan.pixelplus.ru/bitrix/components/bitrix/im.messenger/im.ajax.php?NOTIFY_REMOVE&V=72', {
            method: 'POST',
            credentials: 'same-origin',
            body: `IM_NOTIFY_REMOVE=Y&NOTIFY_ID=${NOTIFY_ID}&IM_AJAX_CALL=Y&sessid=${bitrixSessid}`,
            headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
          })
            .then(() => {
              deletedMessages.push(NOTIFY_ID);
              localStorage.deletedMessages = deletedMessages;
            });
          return true;
        });
        delMessagesLink.innerText = 'Уведомления удалены';
      });
  });

  delMessagesLink.addEventListener('mouseout', (e) => {
    e.target.style.color = '#a8aeb5';
  });
  return true;
}
