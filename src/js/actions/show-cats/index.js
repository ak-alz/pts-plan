import axios from 'axios';
import {shuffle, uniqBy} from 'lodash-es';

import {insertCSS} from '../../utils.js';

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

  aicats: {
    async fetch() {
      const url = new URL('https://api.ai-cats.net/v2/cats/random/bulk');
      url.searchParams.append('size', '256');
      url.searchParams.append('type', 'Image');
      url.searchParams.append('limit', '10');
      const {data} = await axios.get(url.toString());

      return data.map((cat) => {
        const fullUrl = new URL(cat.url);
        fullUrl.searchParams.delete('size');
        return {url: cat.url, fullUrl: fullUrl.toString()};
      });
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

const FAVORITES_STORAGE_KEY = 'show-cats-favorites';

const SOURCE = {
  API: 'api',
  FAVORITES: 'favorites',
  MIXED: 'mixed',
};

const STAR_CSS = `
  .pts-cats { position: relative; margin-top: 14px; line-height: 0; }
  .pts-cats__favorite {
    position: absolute; top: 6px; right: 6px; display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; padding: 0; border: none; border-radius: 50%; cursor: pointer;
    background: rgba(0, 0, 0, 0.45); color: #fff; font-size: 14px; opacity: 0; transition: opacity 0.2s;
  }
  .pts-cats:hover .pts-cats__favorite { opacity: 1; }
  .pts-cats__favorite--active { color: #facc15; }
`;

async function getFavorites() {
  const stored = await chrome.storage.local.get(FAVORITES_STORAGE_KEY);
  return Array.isArray(stored[FAVORITES_STORAGE_KEY]) ? stored[FAVORITES_STORAGE_KEY] : [];
}

// Читаем свежий список прямо перед записью: избранное могли поменять в другой вкладке
async function toggleFavorite(cat) {
  const favorites = await getFavorites();
  const isFavorite = favorites.some((favorite) => favorite.url === cat.url);
  const next = isFavorite
    ? favorites.filter((favorite) => favorite.url !== cat.url)
    : [...favorites, {url: cat.url, fullUrl: cat.fullUrl}];
  await chrome.storage.local.set({[FAVORITES_STORAGE_KEY]: next});
  return !isFavorite;
}

async function loadCats(options) {
  const source = options?.showCatsSource ?? SOURCE.API;
  const favorites = source === SOURCE.API ? [] : await getFavorites();

  // «Только избранные» без единого избранного — берём котов из сервиса, иначе баннер был бы пустым
  const needsApi = source !== SOURCE.FAVORITES || !favorites.length;
  const apiCats = needsApi ? await fetchCats(options?.showCatsProvider) : [];

  return shuffle(uniqBy([...favorites, ...apiCats], 'url'));
}

export async function showCats(options) {
  const leftMenu = document.querySelector('.menu-items-footer-inner');
  const leftMenuCollapsed = !!document.querySelector('.menu-collapsed-mode');
  if (leftMenuCollapsed || !leftMenu) return;

  const initialized = !!leftMenu.querySelector('.js-show-cats');
  if (initialized) return;

  const timeout = 6 * 60 * 1000;
  let cats = await loadCats(options);
  if (!cats.length) return;

  insertCSS(STAR_CSS, 'pts-show-cats-styles');

  let catIndex = 0;
  let currentCat = null;
  let favoriteUrls = new Set((await getFavorites()).map((favorite) => favorite.url));

  const container = Object.assign(document.createElement('div'), {
    className: 'pts-cats js-show-cats',
  });

  const image = Object.assign(document.createElement('img'), {
    className: 'rounded cursor-pointer',
    style: 'display: block; width: 100%; max-width: 100%;',
    alt: 'cats',
    title: 'Открыть в новой вкладке',
    onclick() {
      const target = this.dataset.fullUrl || this.src;
      target && window.open(target);
    },
  });

  const favoriteButton = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'pts-cats__favorite',
  });

  function renderFavoriteButton() {
    const isFavorite = !!currentCat && favoriteUrls.has(currentCat.url);
    favoriteButton.classList.toggle('pts-cats__favorite--active', isFavorite);
    favoriteButton.title = isFavorite ? 'Убрать из избранного' : 'В избранное';
    favoriteButton.innerHTML = `<i class="pi ${isFavorite ? 'pi-star-fill' : 'pi-star'}"></i>`;
  }

  favoriteButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (!currentCat) return;

    const cat = currentCat;
    const isFavorite = await toggleFavorite(cat);
    if (isFavorite) favoriteUrls.add(cat.url);
    else favoriteUrls.delete(cat.url);
    renderFavoriteButton();
  });

  // Звёздочка должна совпадать в каждой открытой вкладке, а не только в той, где нажали
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[FAVORITES_STORAGE_KEY]) return;
    favoriteUrls = new Set((changes[FAVORITES_STORAGE_KEY].newValue ?? []).map((favorite) => favorite.url));
    renderFavoriteButton();
  });

  // Подряд идущие пропуски (пропорции не подошли или файл не открылся — у избранного ссылка могла
  // умереть): перебор идёт по кругу, поэтому без счётчика партия, целиком не прошедшая проверку,
  // качалась бы бесконечно
  let skippedInARow = 0;

  function skipCurrentCat() {
    if (skippedInARow >= cats.length) return;
    skippedInARow += 1;
    updateCat();
  }

  image.addEventListener('load', () => {
    if (!isValidAspectRatio(image.naturalWidth, image.naturalHeight)) {
      skipCurrentCat();
      return;
    }
    skippedInARow = 0;
    image.style.aspectRatio = image.naturalWidth / image.naturalHeight;
  });

  image.addEventListener('error', skipCurrentCat);

  function updateCat() {
    // Прошли весь список — перемешиваем заново, чтобы следующий круг шёл в другом порядке
    if (catIndex > 0 && catIndex % cats.length === 0) cats = shuffle(cats);

    currentCat = cats[catIndex % cats.length];
    catIndex += 1;
    image.dataset.fullUrl = currentCat.fullUrl;
    image.src = currentCat.url;
    renderFavoriteButton();
  }

  updateCat();
  container.append(image, favoriteButton);
  leftMenu.appendChild(container);

  const intervalId = setInterval(() => {
    // Баннер мог уехать из DOM вместе с перерисованным меню — держать таймер и качать изображения
    // в пустоту незачем
    if (!container.isConnected) {
      clearInterval(intervalId);
      return;
    }
    updateCat();
  }, timeout);
}
