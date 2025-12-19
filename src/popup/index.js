import '/src/css/popup.css';

import dayjs from 'dayjs';
import ru from 'dayjs/locale/ru';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import primeVueOptions from '../js/primeVueOptions.js';
import PopupApp from './PopupApp.vue';

dayjs.extend(localizedFormat);
dayjs.locale('ru', ru);

const app = createApp(PopupApp);
app.use(PrimeVue, primeVueOptions);
app.use(ToastService);
app.directive('tooltip', Tooltip);
app.directive('ripple', Ripple);

app.mount('#app');
