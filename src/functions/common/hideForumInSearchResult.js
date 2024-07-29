// в результатах поиска верхней панели скрывает кривые ссылки на страницы форума
export default function hideForumInSearchResult() {
  const searchResults = [...document.querySelectorAll('div.search-title-top-list-wrap div.search-title-top-item.search-title-top-item-js')];
  searchResults.forEach((res) => {
    const searchHref = res.querySelector('a.search-title-top-item-link').href;
    if (searchHref.includes('/community/forum/') || searchHref.includes('#message')) res.style.display = 'none';
  });
}
