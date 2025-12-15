import '/src/css/popup.css';

import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../js/primeVueOptions.js';
import PopupApp from './PopupApp.vue';

const app = createApp(PopupApp);
app.use(PrimeVue, primeVueOptions);
app.use(ToastService);
app.directive('tooltip', Tooltip);
app.directive('ripple', Ripple);

app.mount('#app');
