import { getTaskIdFromUrl, pluralize } from '../../utils.js';

export function showComments(rawCount = 50) {
  const count = Math.ceil(rawCount / 10) * 10;
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const buttonContainer = document.querySelector('.feed-com-header');
  if (!buttonContainer) return;

  const initialized = !!document.querySelector('.js-show-comments');
  if (initialized) return;

  const button = Object.assign(document.createElement('a'), {
    className: 'js-show-comments feed-com-all',
    href: '#',
    textContent: `Загрузить ${count} ${pluralize(count, ['комментарий', 'комментария', 'комментариев'])}`,
  });

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    button.style.pointerEvents = 'none';
    button.style.opacity = '0.5';

    const times = Math.ceil(count / 10);
    for (let i = 0; i < times; i++) {
      const navBtn = document.querySelector('[bx-mpl-comments-count]');
      if (!navBtn) break;

      const prevHref = navBtn.getAttribute('href');
      const done = waitForNavChange(navBtn, prevHref);
      navBtn.click();
      await done;
    }

    button.style.pointerEvents = '';
    button.style.opacity = '';
  });

  buttonContainer.appendChild(button);
  buttonContainer.classList.add('gap-3');
}

function waitForNavChange(navBtn, prevHref) {
  return new Promise((resolve) => {
    const container = navBtn.parentElement;

    const observer = new MutationObserver(() => {
      const newNavBtn = container.querySelector('[bx-mpl-comments-count]');
      if (!newNavBtn || newNavBtn.getAttribute('href') !== prevHref) {
        observer.disconnect();
        clearTimeout(timeout);
        resolve();
      }
    });

    observer.observe(container, { childList: true, subtree: true, attributes: true });

    const timeout = setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 10000);
  });
}
