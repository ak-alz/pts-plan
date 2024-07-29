// удаляет все сообщения задачи на странице /alert/
export default function alertDeleteMessage() {
  window.addEventListener('storage', () => {
    if (!localStorage.deletedMessages) return;
    const deletedMessages = localStorage.deletedMessages.split(',');
    deletedMessages.forEach((message) => {
      const messageToDelete = document.querySelector(`div.message-message[data-id="${message}"]`);
      if (!messageToDelete) return false;
      if (messageToDelete.parentNode.parentNode.parentNode.classList.contains('task-messages-wrapper')) {
        messageToDelete.parentNode.parentNode.parentNode.outerHTML = '';
      } else {
        messageToDelete.parentNode.parentNode.removeChild(messageToDelete.parentNode);
      }
      return true;
    });
    localStorage.removeItem(deletedMessages);
  });
}
