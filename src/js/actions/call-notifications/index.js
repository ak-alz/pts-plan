import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import {createApp} from 'vue';

import primeVueOptions from '../../primeVueOptions.js';
import CallNotificationsApp from './CallNotificationsApp.vue';

export function callNotifications() {
  // Контент-скрипт инжектится во все фреймы (manifest all_frames: true), а виджет монтируется
  // в document.body без привязки к якорю — без этого гварда в каждом iframe Bitrix поднимался бы
  // свой экземпляр приложения, и напоминание дублировалось бы (тост/модалка/браузерное на фрейм)
  if (window.top !== window.self) return;
  if (document.querySelector('.js-call-notifications')) return;

  const appContainer = Object.assign(document.createElement('div'), {
    className: 'js-call-notifications',
  });
  document.body.appendChild(appContainer);

  const app = createApp(CallNotificationsApp);
  app.use(PrimeVue, primeVueOptions);
  app.directive('tooltip', Tooltip);
  app.directive('ripple', Ripple);
  app.mount(appContainer);
}
