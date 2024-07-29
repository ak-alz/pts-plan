// функция для добавления кнопки восстановления длинных ссылок
export default function addLongLinkRepair() {
  if (!location.href.includes('/task/view/') || document.querySelector('span.long-link-repair')) return false;
  const repairLink = document.createElement('span');
  repairLink.className = 'long-link-repair';
  repairLink.style = 'color: #a8aeb5; font-size: 13px; display: block;';
  repairLink.innerText = 'Починить ссылки';
  const likeBlock = document.querySelector('div.task-detail-like');
  if (likeBlock) likeBlock.appendChild(repairLink);

  repairLink.addEventListener('click', (e) => {
    const links = [...document.querySelectorAll('div.task-detail-description a, div.feed-com-text-inner-inner a')];
    links.forEach((link) => {
      if (link.innerText.includes('...')) link.innerText = link.href;
      e.target.innerText = 'OK';
    });
  });

  repairLink.addEventListener('mouseover', (e) => {
    e.target.style.cursor = 'pointer';
    e.target.style.color = '#828b95';
  });
  repairLink.addEventListener('mouseout', (e) => {
    e.target.style.cursor = 'default';
    e.target.style.color = '#a8aeb5';
  });
  return true;
}
