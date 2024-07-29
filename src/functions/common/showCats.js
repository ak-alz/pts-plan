export default function showCats() {
  const interval = 60000;

  function addCatInPage() {
    if (!localStorage.catUrl) localStorage.catUrl = 'https://images.vinted.net/thumbs/310x310/02a55_JrnxsJmHFVDA8dh2cAXqKWF4.jpeg';
    const leftBlock = document.querySelector('.menu-items-body-inner');
    if (document.querySelector('.menu-collapsed-mode') || !leftBlock) return false;
    let img = document.querySelector('img#funny_cat_image');
    if (img) {
      if (img.src === localStorage.catUrl) return false;
    } else {
      img = document.createElement('img');
      img.id = 'funny_cat_image';
      img.style = `position: fixed; left: 0px; bottom: 0px; width: ${parseInt(getComputedStyle(leftBlock).width, 10)}px; height: auto;`;
      leftBlock.appendChild(img);
    }
    img.src = localStorage.catUrl;
    return true;
  }

  window.addEventListener('storage', addCatInPage);
  addCatInPage();

  function getCatFromAPI() {
    if (localStorage.catUpdateTime > Date.now()) {
      setTimeout(getCatFromAPI, interval);
      return false;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.thecatapi.com/v1/images/search', true);
    xhr.send();
    localStorage.catUpdateTime = Date.now() + interval;
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return;
      if (this.status !== 200) return;
      const data = JSON.parse(this.responseText);
      if (data[0].url.includes('http://')) return false;
      localStorage.catUrl = data[0].url;
      addCatInPage();
    }
    return true;
  }

  setTimeout(getCatFromAPI, interval);
  return true;
}
