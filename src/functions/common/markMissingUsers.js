// помечает сообщения задачи, в которых обращаются к юзерам, которые в неё не добавлены
export default function markMissingUsers() {
  if (location.href.includes('/task/view/')) {
    const usersInSidebar = [...document.querySelectorAll('div.task-detail-sidebar-content a.task-detail-sidebar-info-user-name.task-detail-sidebar-info-user-name-link')];
    const usersInCommetns = [...document.querySelectorAll('div.feed-com-text-inner-inner a[href^="/company/personal/user/"]')];
    if (usersInSidebar.length > 0 && usersInCommetns.length > 0) {
      const usersId = [];
      const re = /.*\/user\/(\d+?)\/.*/i;
      usersInSidebar.forEach((user) => {
        const id = re.exec(user.href);
        if (id) usersId.push(id[1]);
      });

      usersInCommetns.forEach((user) => {
        const userId = re.exec(user.href);
        if (!usersId.includes(userId[1]) && !user.classList.contains('marked-link')) {
          user.style = `background-image: url(https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Emblem-important-red.svg/120px-Emblem-important-red.svg.png);
                        background-repeat: no-repeat;
                        background-size: 15px 15px;
                        background-position-x: 99%;
                        padding-right: 20px;`;
          user.title = 'Пользователь не добавлен в задачу';
          user.classList.add('marked-link');
        } else if (usersId.includes(userId[1]) && user.classList.contains('marked-link')) {
          user.style = '';
          user.title = '';
          user.classList.remove('marked-link');
        }
        return true;
      });
    }
  }
}
