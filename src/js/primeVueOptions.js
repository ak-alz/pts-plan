import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { ru } from 'primelocale/ru.json';

export default {
  theme: {
    preset: definePreset(Aura, {
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
    }),
    options: {
      darkModeSelector: false,
    },
  },
  ripple: true,
  locale: ru,
};
