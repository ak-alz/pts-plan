import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import {createApp} from 'vue';

import primeVueOptions from '../primeVueOptions.js';
import {onShowToast, showToast} from './showToast.js';
import ToastHostApp from './ToastHostApp.vue';

// Пока хост не смонтирован, в DOM нет и его контейнера-маркера, поэтому от повторного вызова
// защищает флаг: два слушателя подняли бы два хоста, и каждый тост показался бы дважды
let armed = false;

function mountToastHost() {
  const container = Object.assign(document.createElement('div'), {
    className: 'js-toast-host',
  });
  document.body.appendChild(container);

  const app = createApp(ToastHostApp);
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.mount(container);
}

/**
 * Готовит единственный на всё расширение хост тостов — по одному на фрейм. Фичи вызывают
 * `showToast()` (`./showToast.js`) вместо собственных `ToastService` + `<PtsToast>`: это
 * единственное Vue-приложение, которое их реально отрисовывает. Тема — общая с остальными
 * виджетами (`.pts-dark`, см. `primeVueOptions.js`).
 */
export function initToastHost() {
  // showToast() шлёт CustomEvent на `window`, а `window` у каждого фрейма свой — события не
  // пересекают границу iframe. Виджету внутри iframe нужен хост в том же фрейме, поэтому здесь
  // (в отличие от гварда на верхний фрейм в call-notifications) хост готовится в каждом фрейме —
  // контент-скрипт и так инжектится во все (all_frames: true в манифесте).
  if (armed || document.querySelector('.js-toast-host')) return;
  armed = true;

  // Само Vue-приложение монтируется только на первом showToast(): на странице полно iframe
  // Bitrix, которые не покажут ни одного тоста, да и большинство загрузок страницы обходятся без
  // них — платить приложением PrimeVue заранее в каждом фрейме незачем.
  const unsubscribe = onShowToast((message) => {
    unsubscribe();
    mountToastHost();
    // app.mount() выполняет onMounted хоста синхронно, так что он уже слушает — но сообщение,
    // которое и вызвало монтирование, он пропустил, поэтому отправляем его повторно.
    showToast(message);
  });
}
