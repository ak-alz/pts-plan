// добавляет кнопку разворачивания всех сообщений задачи
export default function openAllCommentsInTask() {
  if (!location.href.includes('/task/view/')) return false;
  const pagination = document.querySelector('a.feed-com-all');
  if (pagination && !document.querySelector('a.open-all-comments')) {
    const openAllComments = document.createElement('a');
    let url = location.href.replace(/#.*/gi, '');
    openAllComments.className = 'feed-com-all open-all-comments';
    url += window.location.search === '' ? '?MID=1' : '&MID=1';
    openAllComments.setAttribute('href', url);
    openAllComments.innerText = ' | Открыть все комментарии';
    pagination.parentNode.insertBefore(openAllComments, pagination.nextElementSibling);
  }
  return true;
}
