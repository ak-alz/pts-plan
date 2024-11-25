// отмечает сообщения, которые никому не адресованы
export default function markMessagesWithoutDestination() {
  if (!location.href.includes('/task/view/')) return false;
  const messages = [...document.querySelectorAll('div.feed-com-text')];

  function markMessageBlock(message, text, link) {
    const messageUserBox = message.previousElementSibling;
    const warningImg = document.createElement('span');
    if (!messageUserBox.querySelector('span.warning_message')) {
      warningImg.className = 'warning_message';
      warningImg.style = `background-image: url(https://stjah.com/image/catalog/text/01publick.png);
                          width: 20px;
                          height: 20px;
                          top: 5px;
                          position: absolute;
                          z-index: 9999;
                          background-size: 20px 20px;`;
      warningImg.title = text;
      messageUserBox.appendChild(warningImg);
    }
    if (link && !link.classList.contains('marked')) {
      link.style = `background-image: url(https://minecraft-statistic.net/img/screen/icon/166252.png);
                    background-repeat: no-repeat;
                    background-size: 15px 15px;
                    background-position-x: 99%;
                    padding-right: 20px;`;
      link.title = 'Упоминание пользователя не в первых 100 символах сообщения';
      link.classList.add('marked');
    }
  }

  messages.forEach((message) => {
    const messageUserBox = message.previousElementSibling;
    const messageUserId = messageUserBox.firstChild.getAttribute('bx-tooltip-user-id');
    let isUsersMarksIn100Sym = false;
    let messageText = message.innerText;
    const re = /\/company\/personal\/user\/(\d+?)\/.*/i;
    messageText = messageText.substring(0, 101);
    if (messageText.toLowerCase().includes('tagall')) {
      if (messageUserBox.querySelector('span.warning_message')) messageUserBox.querySelector('span.warning_message').className = '';
      return false;
    }
    const usersInCommetns = message.querySelectorAll('a[href*="/company/personal/user/"]');
    for (let i = 0; i < usersInCommetns.length; i++) {
      if (usersInCommetns[i].href.includes('/task/')) continue;
      const linkText = usersInCommetns[i].innerText;
      const linkIdUserId = re.exec(usersInCommetns[i].href)[1];
      if (messageUserId === linkIdUserId) continue;
      if (!messageText.includes(linkText)) {
        markMessageBlock(message, 'Обращение к пользователю не в первых 100 символах', usersInCommetns[i]);
      } else {
        isUsersMarksIn100Sym = true;
      }
    }

    if (messageUserBox.querySelector('span.warning_message')) return false;
    if (!isUsersMarksIn100Sym) markMessageBlock(message, 'В первой части комментария нет ни одного обращения к другому пользователю', undefined);

    // const warningImg = document.createElement('span');
    // warningImg.className = 'warning_message';
    // warningImg.style = 'background-image: url(https://stjah.com/image/catalog/text/01publick.png); width: 20px; height: 20px; top: 5px; position: absolute; z-index: 9999; background-size: 20px 20px;';
    // warningImg.title = 'В первой части комментария нет ни одного обращения к другому пользователю';
    // messageUserBox.appendChild(warningImg);
    return true;
  });
  return true;
}
