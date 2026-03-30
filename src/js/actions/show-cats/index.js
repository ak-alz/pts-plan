import axios from 'axios';

function isValidAspectRatio(width, height) {
  if (!height) return true;
  const ratio = width / height;
  return ratio >= 0.5 && ratio <= 2;
}

const providers = {
  thecatapi: {
    async fetch() {
      const url = new URL('https://api.thecatapi.com/v1/images/search');
      url.searchParams.append('size', 'thumb');
      url.searchParams.append('mime_types', 'jpg');
      url.searchParams.append('limit', '10');
      const {data} = await axios.get(url.toString());

      return data
        .filter((cat) => isValidAspectRatio(cat.width, cat.height))
        .map((cat) => ({url: cat.url}));
    },
  },

  cataas: {
    async fetch() {
      const url = new URL('https://cataas.com/api/cats');
      url.searchParams.append('limit', '20');
      url.searchParams.append('skip', Math.floor(Math.random() * 1977));
      const {data} = await axios.get(url.toString());

      return data
        .filter((cat) => cat.mimetype !== 'image/gif')
        .map((cat) => ({url: `https://cataas.com/cat/${cat.id}?width=212`}));
    },
  },
};

export async function showCats(options) {
  const leftMenu = document.querySelector('.menu-items-footer-inner');
  const leftMenuCollapsed = !!document.querySelector('.menu-collapsed-mode');
  if (leftMenuCollapsed || !leftMenu) return;

  const initialized = !!leftMenu.querySelector('.js-show-cats');
  if (initialized) return;

  const provider = providers[options?.showCatsProvider] ?? providers.thecatapi;

  let catIndex = 0;
  const timeout = 6 * 60 * 1000;
  const cats = await provider.fetch();
  if (!cats?.length) return;

  const image = Object.assign(document.createElement('img'), {
    className: 'rounded cursor-pointer js-show-cats',
    style: 'margin-top: 14px; width: 100%; max-width: 100%;',
    alt: 'cats',
    title: 'Открыть в новой вкладке',
    onclick() {
      this.src && window.open(this.src);
    },
  });

  image.addEventListener('load', () => {
    if (!isValidAspectRatio(image.naturalWidth, image.naturalHeight)) {
      updateCat();
      return;
    }
    image.style.aspectRatio = image.naturalWidth / image.naturalHeight;
  });

  function updateCat() {
    const cat = cats[catIndex % cats.length];
    catIndex += 1;
    image.src = cat.url;
  }

  updateCat();
  leftMenu.appendChild(image);
  setInterval(updateCat, timeout);
}
