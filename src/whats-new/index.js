import '/src/css/app.css';

import PrimeVue from 'primevue/config';
import {createApp} from 'vue';

import primeVueOptions from '../js/primeVueOptions.js';
import WhatsNewApp from './WhatsNewApp.vue';

const app = createApp(WhatsNewApp);
app.use(PrimeVue, primeVueOptions);
app.mount('#app');
