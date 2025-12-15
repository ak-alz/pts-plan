import pluginJs from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  pluginJs.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
        chrome: 'readonly',
        axios: 'readonly',
      },
    },
    rules: {
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'quotes': ['error', 'single'],

      'vue/require-component-is': 'off',
      'vue/no-v-html': 'off',
      'vue/no-v-text-v-html-on-component': 'off',
      'vue/define-macros-order': ['error', {
        'order': ['defineOptions', 'defineProps', 'defineEmits', 'defineModel', 'defineSlots'],
        'defineExposeLast': true,
      }],

      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
];
