// для задач указывает названия групп, к которым они относятся
export default function addGroupName() {
  const blocks = [...document.querySelectorAll('div.task-messages-wrapper')];
  blocks.forEach((block) => {
    const gropuA = block.querySelector('div.task-messages div.message-item div.message-message a');
    const groupURL = gropuA.href.replace(/task\/view\/.+/gi, '');
    const re = /в группе (.+)\)/gi;
    const groupName = re.exec(gropuA.outerHTML);
    if (!Array.isArray(groupName)) return false;
    const taskTitle = block.querySelector('div.task-title');
    const aElement = document.createElement('a');
    aElement.setAttribute('href', groupURL);
    aElement.innerText = groupName[1];
    taskTitle.innerHTML += ' | Группа ';
    taskTitle.appendChild(aElement);
    return true;
  });
}
