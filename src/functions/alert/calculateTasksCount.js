// Функция для изменения числа оставшихся задач при их удалении
// FIXME: неправильно считает полное число задач, если выводить не все на страницу
export default function calculateTasksCount() {
  const messages = document.querySelector('.im-messages');
  if (!messages) return;

  const messagesObserver = new MutationObserver((mutations) => {
    const alertTotal = document.querySelector('.alert-total b');
    if (alertTotal) {
      alertTotal.innerText = messages.children.length;
    }

    const filterSelect = document.querySelector('select.plan_injection_messages_filter');
    if (!filterSelect) return;

    const regex = /injection_script_filter_([\da-z]+)/gi;
    let filterName = regex.exec(mutations[0].removedNodes[0].className);
    if (!filterName) return;
    filterName = filterName[1];

    const selectOption = document.querySelector(`select.plan_injection_messages_filter option[value="${filterName}"]`);
    if (!selectOption) return;

    let tasksCount = / \((\d+)\)/gi.exec(selectOption.innerText);
    if (!tasksCount) return;

    tasksCount = tasksCount[1] - 1;
    selectOption.innerText = selectOption.innerText.replace(/ \((\d+)\)/gi, ` (${tasksCount})`);
  });

  messagesObserver.observe(
    messages,
    {
      childList: true,
    },
  );
}
