import '/src/css/app.css';

import dayjs from 'dayjs';
import ru from 'dayjs/locale/ru';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import {createApp} from 'vue';

import {createPrimeVueOptions} from '../js/primeVueOptions.js';
import WhatsNewApp from './WhatsNewApp.vue';

dayjs.extend(localizedFormat);
dayjs.locale('ru', ru);

const app = createApp(WhatsNewApp);
app.use(PrimeVue, createPrimeVueOptions({darkModeSelector: '.dark'}));
app.use(ToastService);
app.directive('tooltip', Tooltip);
app.directive('ripple', Ripple);
app.mount('#app');
