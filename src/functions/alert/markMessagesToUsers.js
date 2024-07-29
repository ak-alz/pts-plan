// отмечает сообщения и задачи, которые адресованы юзеру
export default function markMessagesToUsers(firstName, secondName) {
  const messages = [...document.querySelectorAll('div.message-message')];
  messages.forEach((message) => {
    if (message.innerText.includes(`${firstName} ${secondName}`)
      || message.innerText.includes(`${secondName} ${firstName}`)
      || message.innerText.toLowerCase().includes('tagall')) {
      message.previousElementSibling.style = 'background-image: url(https://e.unicode-table.com/orig/81/912866cba59b54bb8f5271f6ac5a68.png); background-repeat: no-repeat; background-size: 20px; background-position: -2px 37%;';
    }
  });

  const blocks = [...document.querySelectorAll('div.task-messages-wrapper')];
  blocks.forEach((block) => {
    if (
      block.querySelector('div.task-messages').innerText.includes(`${firstName} ${secondName}`)
      || block.querySelector('div.task-messages').innerText.includes(`${secondName} ${firstName}`)
      || block.querySelector('div.task-messages').innerText.toLowerCase().includes('tagall')
    ) {
      block.style = 'background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%228%22%20height%3D%2211%22%20viewBox%3D%220%200%208%2011%22%3E%0A%20%20%3Cpath%20fill%3D%22%23F16C0A%22%20fill-rule%3D%22evenodd%22%20d%3D%22M200.069979%2C24%20L200.14%2C24%20C200.14%2C24%20203%2C23.0560625%20203%2C20.390625%20C203%2C16.6348125%20199.346667%2C15.8813125%20199.666667%2C13%20C197.993333%2C13.8339375%20195%2C16.75375%20195%2C19.875%20C195.039359%2C21.7259245%20196.174362%2C23.3629491%20197.86%2C24%20L197.86%2C24%20L198.123417%2C24%20C197.460595%2C23.3218266%20197.059336%2C22.4251727%20197%2C21.4707569%20C197.092476%2C20.0452868%20197.868205%2C18.7524059%20199.082454%2C18%20C200.109798%2C20.1851885%20201.164908%2C19.9436239%20201.164908%2C21.4707569%20C201.162991%2C22.4339232%20200.76293%2C23.3471724%20200.069979%2C24%20Z%22%20transform%3D%22translate%28-195%20-13%29%22/%3E%0A%3C/svg%3E%0A"); background-repeat: no-repeat; background-size: 13px; background-position: 5px 17px;';
    }
  });
}
