// добавляет кнопку открытия всех задач
export default function addAllTasksOpenButton() {
  const openAllTasks = document.createElement('span');
  openAllTasks.style = 'display: inline-block; vertical-align: middle; background-color: #e4ae16; padding: 0 10px; font-size: 12px; text-align: center; text-align-last: center; line-height: 24px; border: none; color: #ffffff; transition: all .3s; box-sizing: border-box; cursor: pointer; border-radius: 6px;';
  openAllTasks.innerText = 'Открыть все задачи';
  document.querySelector('a.delete-button').parentNode.insertBefore(openAllTasks, document.querySelector('a.delete-button').nextElementSibling);

  openAllTasks.addEventListener('click', () => {
    const tasksMessages = [...document.querySelectorAll('div.message-message')];
    const tasksId = [];
    tasksMessages.forEach((message) => {
      const link = message.querySelector('a').href;
      if (!link.includes('/tasks/task/view/')) return false;
      const re = /\/tasks\/task\/view\/(\d+?)\/.*/i;
      const messageTaskId = re.exec(link)[1];
      if (tasksId.includes(messageTaskId)) return false;
      tasksId.push(messageTaskId);
      window.open(link);
      return true;
    });
  });
}
