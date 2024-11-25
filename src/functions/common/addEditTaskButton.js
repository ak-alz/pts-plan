// в канбане добавляет кнопку редактирования задачи
export default function addEditTaskButton() {
  const kanbanItemEdit = [...document.querySelectorAll('div.tasks-kanban-item')];
  kanbanItemEdit.forEach((item) => {
    if (item.querySelector('a.edit-task-link')) return false;
    const link = item.querySelector('a.tasks-kanban-item-title').href.replace('/view/', '/edit/');
    const editTaskA = document.createElement('a');
    editTaskA.setAttribute('href', link);
    editTaskA.className = 'edit-task-link';
    editTaskA.setAttribute('onclick', 'event.stopPropagation()');
    editTaskA.setAttribute('title', 'Редактировать задачу');
    editTaskA.style = `background-image: url(https://quantummedia.it/wp-content/uploads/2018/01/if_Edit_1891026.png);
                       width: 15px;
                       height: 15px;
                       right: 5px;
                       top: 5px;
                       position: absolute;
                       z-index: 9999;
                       background-size: 15px 15px;`;
    item.insertBefore(editTaskA, item.firstChild);
    return true;
  });
}
