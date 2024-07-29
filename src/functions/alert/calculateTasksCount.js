// функция для изменения числа оставшихся задач при их удалении
export default function calculateTasksCount() {
  const messages = document.querySelector('div.im-messages');
  if (!messages) return false;
  const messagesObserver = new MutationObserver((mutations) => {
    const cnt = (document.querySelector('div.im-messages')) ? document.querySelector('div.im-messages').children.length : 0;
    const alertTotal = document.querySelector('span.alert-total b');
    if (alertTotal) alertTotal.innerText = cnt;
    const filerSelect = document.querySelector('select.plan_injection_messages_filter');
    if (filerSelect) {
      let filterName = /injection_script_filter_([\da-z]+)/gi.exec(mutations[0].removedNodes[0].className);
      if (filterName) filterName = filterName[1];
      const selectOption = document.querySelector(`select.plan_injection_messages_filter option[value="${filterName}"]`);
      if (!selectOption) return false;
      let tasksCnt = / \((\d+)\)/gi.exec(selectOption.innerText);
      if (tasksCnt) tasksCnt = Number(tasksCnt[1]) - 1;
      selectOption.innerText = selectOption.innerText.replace(/ \((\d+)\)/gi, ` (${tasksCnt})`);
    }
    return true;
  });
  messagesObserver.observe(messages, {attributes: false, childList: true, characterData: false});
  return true;
}
