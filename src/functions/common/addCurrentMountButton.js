// в канбане добавляет кнопку указания текущего месяца к задаче
export default function addCurrentMountButton(bitrixSessid) {
  const kanbanItem = [...document.querySelectorAll('div.tasks-kanban-item')];
  kanbanItem.forEach((item) => {
    if (item.querySelector('span.add-mount-tag')) return false;
    const mountTag = document.createElement('span');
    mountTag.className = 'add-mount-tag';
    mountTag.setAttribute('onclick', 'event.stopPropagation();');
    mountTag.setAttribute('title', 'Добавить тег текущего месяца');
    mountTag.style = 'background-image: url(https://files.softicons.com/download/application-icons/toolbar-icons-by-gentleface/png/128/tag.png); width: 15px;height: 15px;right: 5px;top: 23px;position: absolute;z-index: 9999;background-size: 15px 15px;';
    mountTag.addEventListener('click', (e) => {
      const date = new Date()
        .toLocaleString('ru', {
          year: 'numeric',
          month: 'long',
        })
        .replace(/ (\d\d|г\.)/gi, ' ')
        .trim();
      const re = /.*\/view\/(\d+?)\/.*/gi;
      const taskId = re.exec(e.target.parentNode.querySelector('a.tasks-kanban-item-title').href);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://plan.pixelplus.ru/bitrix/components/bitrix/tasks.base/ajax.php', true);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
      xhr.send(`sessid=${bitrixSessid}&EMITTER=&ACTION[0][OPERATION]=task.update&ACTION[0][ARGUMENTS][id]=${taskId[1]}&ACTION[0][ARGUMENTS][data][TAGS]=${date}`);
    });

    mountTag.addEventListener('mouseover', (e) => {
      e.target.style.cursor = 'pointer';
    });
    mountTag.addEventListener('mouseout', (e) => {
      e.target.style.cursor = 'default';
      e.target.style.color = '#a8aeb5';
    });
    item.insertBefore(mountTag, item.firstChild);
    return true;
  });
}
