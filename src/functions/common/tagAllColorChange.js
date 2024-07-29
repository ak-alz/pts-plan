// задаёт класс для TAGALL в сообщениях
export default function tagAllColorChange() {
  if (location.href.includes('/task/view/')) {
    const commentsBlocks = [...document.querySelectorAll('div.feed-com-text div.feed-com-text-inner')];
    commentsBlocks.forEach((comment) => {
      if (!comment.querySelector('b.tagall_color') && comment.innerText.includes('TAGALL')) {
        comment.innerHTML = comment.innerHTML.replace(/TAGALL/g, '<b class="tagall_color">TAGALL</b>');
      }
    });
  }
}
