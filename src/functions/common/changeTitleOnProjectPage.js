// на страницах проектов добавляет в title название проекта
// TODO: в канбане криво работает
export default function changeTitleOnProjectPage() {
  if (location.href.search(/^https:\/\/plan.pixelplus.ru\/workgroups\/group\/\d.+?\/tasks\/($|\?)/gi) !== -1) {
    let messagesCnt = '';
    if (document.title[0] === '(') {
      const re = /^(\(.+?\))/gi;
      messagesCnt = `${re.exec(document.title)[1]} `;
    }
    const el = document.querySelector('div.profile-menu-info a');
    let additionalTitle = '';
    if (el) {
      additionalTitle = `${el.innerText.replace(' — SEO', '')} — Задачи проекта`;
    }
    document.title = messagesCnt + additionalTitle;
  }
  if (document.title[0] !== '(') {
    const alertNum = document.querySelector('div.bx-im-informer-num');
    if (alertNum && alertNum.innerText.length > 0) document.title = `(${alertNum.innerText}) ${document.title}`;
  }
}
