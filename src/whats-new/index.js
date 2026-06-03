import '/src/css/app.css';

import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import {createApp} from 'vue';

import primeVueOptions from '../js/primeVueOptions.js';
import WhatsNewApp from './WhatsNewApp.vue';

const app = createApp(WhatsNewApp);
app.use(PrimeVue, primeVueOptions);
app.use(ToastService);
app.directive('tooltip', Tooltip);
app.directive('ripple', Ripple);
app.mount('#app');
