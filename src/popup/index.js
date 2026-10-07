import '/src/css/app.css';

import dayjs from 'dayjs';
import ru from 'dayjs/locale/ru';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import {createPrimeVueOptions} from '../js/primeVueOptions.js';
import PopupApp from './PopupApp.vue';

dayjs.extend(localizedFormat);
dayjs.locale('ru', ru);

// Окну попапа расширения Chrome шлёт `resize` при любом изменении разметки, даже когда размер не
// меняется — окно так и остаётся 600×550. PrimeVue по любому `resize` закрывает свои всплывающие
// слои, поэтому подсказка к опции успевала открыться и тут же схлопывалась: курсор снова оказывался
// на иконке, подсказка открывалась заново, и цикл повторялся. Размер у попапа фиксированный,
// настоящих ресайзов у него не бывает, так что событие здесь гасим. Обработчики на `window`
// вызываются в порядке подписки, а этот навешивается до монтирования — то есть раньше любого слоя.
window.addEventListener('resize', event => event.stopImmediatePropagation(), true);

const app = createApp(PopupApp);
app.use(PrimeVue, createPrimeVueOptions({darkModeSelector: '.dark'}));
app.use(ToastService);
app.directive('tooltip', Tooltip);
app.directive('ripple', Ripple);

app.mount('#app');
