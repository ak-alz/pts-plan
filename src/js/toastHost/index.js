import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import {createApp} from 'vue';

import primeVueOptions from '../primeVueOptions.js';
import ToastHostApp from './ToastHostApp.vue';

/**
 * Mounts the single, extension-wide toast host once per frame. Features call `showToast()`
 * (`./showToast.js`) instead of running their own `ToastService` + `<PtsToast>` — this is the
 * one Vue app that actually renders them. Follows the same shared theme as every other widget
 * (`.pts-dark`, see `primeVueOptions.js`).
 */
export function initToastHost() {
  // showToast() dispatches a CustomEvent on `window` — every frame has its own separate `window`,
  // events don't cross iframe boundaries. A widget mounted inside an iframe needs a host in that
  // same iframe to be heard, so — unlike call-notifications' top-frame-only guard — this one
  // mounts in every frame (manifest all_frames: true already injects the content script into all).
  if (document.querySelector('.js-toast-host')) return;

  const container = Object.assign(document.createElement('div'), {
    className: 'js-toast-host',
  });
  document.body.appendChild(container);

  const app = createApp(ToastHostApp);
  app.use(PrimeVue, primeVueOptions);
  app.use(ToastService);
  app.mount(container);
}
