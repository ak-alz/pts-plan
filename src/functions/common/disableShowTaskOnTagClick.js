// отключает открытие задачи при клике на тег задачи в канбане
export default function disableShowTaskOnTagClick() {
  const kanbanTaskItems = [...document.querySelectorAll('span.tasks-kanban-item-tags span')];
  kanbanTaskItems.forEach((item) => {
    if (item.hasAttribute('onclick')) return false;
    item.setAttribute('onclick', 'event.stopPropagation();');
    return true;
  });
}
