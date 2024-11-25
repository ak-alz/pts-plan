// Добавить кнопку для удаления всех уведомлений текущей задачи
// Добавляет обработчик на страницу /alert/
// Единственный смысл этой функции:
// сли по соседству была открыта вкладка /alert/,
// то эти уведомления удалятся оттуда без перезагрузки
export default function addDeleteAllTaskMessagesListener() {
  window.addEventListener('storage', () => {
    const data = window.localStorage.getItem('deletedMessages');
    if (!data) return;

    const deletedMessages = data.split(',');

    deletedMessages.forEach((id) => {
      const message = document.querySelector(`.message-message[data-id="${id}"]`);
      if (!message) return;

      if (message.parentNode.parentNode.parentNode.classList.contains('task-messages-wrapper')) {
        message.parentNode.parentNode.parentNode.outerHTML = '';
      } else {
        message.parentNode.parentNode.removeChild(message.parentNode);
      }
    });

    window.localStorage.removeItem('deletedMessages');
  });
}
