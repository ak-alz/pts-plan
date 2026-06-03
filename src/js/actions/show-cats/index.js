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
        .map((cat) => ({url: cat.url, fullUrl: cat.url}));
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
        .map((cat) => ({
          url: `https://cataas.com/cat/${cat.id}?width=212`,
          fullUrl: `https://cataas.com/cat/${cat.id}`,
        }));
    },
  },

  httpcat: {
    fetch() {
      const allCodes = [
        100, 101, 102, 103,
        200, 201, 202, 204, 206, 207,
        301, 302, 304, 307, 308,
        400, 401, 402, 403, 404, 405, 406, 408, 409, 410,
        411, 412, 413, 414, 415, 416, 418, 421, 422, 423,
        424, 425, 426, 428, 429, 431, 451,
        500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511, 599,
      ];

      const selectedCodes = allCodes
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);

      return selectedCodes.map((code) => ({
        url: `https://http.cat/images/${code}.jpg`,
        fullUrl: `https://http.cat/${code}`,
      }));
    },
  },
};

async function fetchCats(preferredProvider) {
  // выбранный провайдер пробуем первым, остальные — как запасные
  const orderedKeys = [
    preferredProvider,
    ...Object.keys(providers).filter((key) => key !== preferredProvider),
  ];

  for (const key of orderedKeys) {
    const provider = providers[key];
    if (!provider) continue;

    try {
      const cats = await provider.fetch();
      if (cats?.length) return cats;
    } catch {
      // провайдер недоступен или вернул ошибку — пробуем следующий
    }
  }

  return [];
}

export async function showCats(options) {
  const leftMenu = document.querySelector('.menu-items-footer-inner');
  const leftMenuCollapsed = !!document.querySelector('.menu-collapsed-mode');
  if (leftMenuCollapsed || !leftMenu) return;

  const initialized = !!leftMenu.querySelector('.js-show-cats');
  if (initialized) return;

  let catIndex = 0;
  const timeout = 6 * 60 * 1000;
  const cats = await fetchCats(options?.showCatsProvider);
  if (!cats.length) return;

  const image = Object.assign(document.createElement('img'), {
    className: 'rounded cursor-pointer js-show-cats',
    style: 'margin-top: 14px; width: 100%; max-width: 100%;',
    alt: 'cats',
    title: 'Открыть в новой вкладке',
    onclick() {
      const target = this.dataset.fullUrl || this.src;
      target && window.open(target);
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
    image.dataset.fullUrl = cat.fullUrl;
    image.src = cat.url;
  }

  updateCat();
  leftMenu.appendChild(image);
  setInterval(updateCat, timeout);
}
