// закрывает сообщения, которые не адресованы юзеру
export default function hideNotForUserMessages(firstName, secondName) {
  const popUpMessages = [...document.querySelectorAll('div.bx-notifyManager-item')];
  popUpMessages.forEach((message) => {
    if (
      message.innerText.includes(' комментарий к задаче [#')
      && (!message.innerText.includes(`${firstName} ${secondName}`)
        && !message.innerText.includes(`${secondName} ${firstName}`) && !message.innerText.toLowerCase().includes('tagall'))
    ) message.querySelectorAll('a.bx-notifier-item-delete')[0].click();
  });
}
