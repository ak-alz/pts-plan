import {definePreset} from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import {ru} from 'primelocale/ru.json';

const preset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{cyan.50}',
      100: '{cyan.100}',
      200: '{cyan.200}',
      300: '{cyan.300}',
      400: '{cyan.400}',
      500: '{cyan.500}',
      600: '{cyan.600}',
      700: '{cyan.700}',
      800: '{cyan.800}',
      900: '{cyan.900}',
      950: '{cyan.950}',
    },
  },
  components: {
    dialog: {
      root: {
        headerPadding: '10px',
        contentPadding: '0 10px 10px 10px',
        titleFontSize: '16px',
      },
    },
  },
});

/**
 * Собирает общий конфиг PrimeVue.
 * @param {object} [options] - Переопределения.
 * @param {boolean|string} [options.darkModeSelector] - Селектор тёмной темы для PrimeVue. По умолчанию `.pts-dark` — класс, который контент-скрипты вешают на `<html>` страницы Bitrix только при явно выбранной тёмной теме (см. `isolated.js`), но никогда при `auto`: сама страница Bitrix всегда светлая. Попап и «Что нового» передают сюда `.dark` — его на своём документе переключает `useTheme.js`.
 * @returns {object} Опции плагина PrimeVue, готовые для `app.use(PrimeVue, ...)`.
 */
export function createPrimeVueOptions({darkModeSelector = '.pts-dark'} = {}) {
  return {
    theme: {
      preset,
      options: {
        darkModeSelector,
      },
    },
    ripple: true,
    locale: ru,
    // Bitrix-страница держит собственные полноэкранные панели (например слайдер задачи) на высоком
    // z-index — модалки должны перекрывать их, а не прятаться под ними. Toast сюда не входит (не
    // одна из категорий zIndex у PrimeVue) — его z-index задаётся отдельно через baseZIndex, см. PtsToast.vue
    zIndex: {
      modal: 1000,
    },
    pt: {
      avatar: {
        image: {class: 'object-cover'},
      },
      select: {
        label: {
          style: {
            fontSize: '14px',
          },
        },
      },
      inputtext: {
        root: {
          style: {
            fontSize: '14px',
          },
        },
      },
      textarea: {
        root: {
          style: {
            fontSize: '14px',
            minHeight: '35px',
            resize: 'vertical',
            display: 'block',
          },
        },
      },
      inputgroupaddon: {
        root: {
          style: {
            padding: '0.375rem',
            minWidth: 'unset',
          },
        },
      },
    },
  };
}

export default createPrimeVueOptions();
