import axios from 'axios';

(() => {
  async function fetchCats() {
    const url = new URL('https://api.thecatapi.com/v1/images/search');
    url.searchParams.append('size', 'thumb');
    url.searchParams.append('mime_types', 'jpg');
    url.searchParams.append('limit', '10');
    const {data} = await axios.get(url.toString());

    return data;
  }

  async function init() {
    const leftMenu = document.querySelector('.menu-items-footer-inner');
    const leftMenuCollapsed = !!document.querySelector('.menu-collapsed-mode');
    if (leftMenuCollapsed || !leftMenu) return;

    const initialized = !!leftMenu.querySelector('.js-show-cats');
    if (initialized) return;

    let catIndex = 0;
    const timeout = 6 * 60 * 1000;
    const cats = await fetchCats();
    if (!cats?.length) return;

    const image = Object.assign(document.createElement('img'), {
      className: 'rounded cursor-pointer js-show-cats',
      style: 'margin-top: 14px; max-width: 100%;',
      alt: 'thecatapi.com',
      title: 'Открыть в новой вкладке',
      onclick() {
        this.src && window.open(this.src);
      },
    });

    function updateCat() {
      const cat = cats[catIndex % cats.length];
      catIndex += 1;

      image.src = cat.url;
      image.style.aspectRatio = cat.height > 0
        ? Math.round(cat.width / cat.height * 100) / 100
        : 1;
    }

    updateCat();

    leftMenu.appendChild(image);

    setInterval(updateCat, timeout);
  }

  init();
})();
