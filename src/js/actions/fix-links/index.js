import {getTaskIdFromUrl, rehydrateOnChanges} from '../../utils.js';

(() => {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  // Bitrix обрезает длинный адрес, заменяя середину или конец на «...», но начало (и хвост, если он
  // остался) совпадают с настоящим href. Проверяем именно это, а не просто наличие многоточия:
  // иначе осмысленная подпись ссылки со своим многоточием («см. подробности...») затиралась бы
  // голым адресом, и исходный текст терялся безвозвратно
  function isTruncatedUrl(text, href) {
    const parts = text.trim().split('...');
    if (parts.length < 2) return false;

    // Протокол в видимом тексте Bitrix иногда опускает — сравниваем без него
    const withoutProtocol = (value) => value.replace(/^https?:\/\//i, '');
    const head = withoutProtocol(parts[0]);
    const tail = parts[parts.length - 1];
    if (!head) return false;

    const normalizedHref = withoutProtocol(href);
    return normalizedHref.startsWith(head) && normalizedHref.endsWith(tail);
  }

  function fixLinks() {
    const links = document.querySelectorAll('.task-detail-description a:not(.js-link-fixed), .feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner a:not(.js-link-fixed)');
    links.forEach((link) => {
      if (isTruncatedUrl(link.textContent, link.href)) {
        link.classList.add('js-link-fixed');
        link.textContent = link.href;
      }
    });
  }

  fixLinks();

  rehydrateOnChanges(
    fixLinks,
    document.querySelector('.feed-comments-block'),
    {
      filterMutation: (mutation) => !mutation.target.closest('.feed-com-add-box-outer'),
    },
  );
})();
