import {escape} from 'lodash-es';

import {PROMPT_VARIABLE_RE} from './patterns.js';
import {minifyPrompt} from './utils.js';

/**
 * Описание промпта AI-фичи для библиотеки промптов: какие переменные можно вставить в свой шаблон
 * и как выглядит стандартный промпт. Стандартный при запуске фича по-прежнему строит своим кодом —
 * здесь он нужен только как отправная точка для своего шаблона.
 * @typedef {Object} PromptSpec
 * @property {string} key - Ключ фичи; промпты хранятся в `ai-prompts-<key>`.
 * @property {string} title - Название для заголовка окна.
 * @property {Array<{key: string, label: string, description?: string}>} variables - Переменные шаблона.
 * @property {function(Record<string, string>): string} buildDefault - Стандартный промпт по значениям переменных.
 * @property {string} [formatNote] - Что обязательно должно остаться в ответе нейросети, чтобы фича его разобрала.
 */

/**
 * Подставляет значения в шаблон: `{{key}}` → `values[key]`. Неизвестная переменная остаётся как есть,
 * чтобы опечатку было видно в предпросмотре, а не молча получить пустое место.
 * @param {string} template - Шаблон промпта.
 * @param {Record<string, any>} values - Значения переменных.
 * @returns {string}
 */
export function renderPromptTemplate(template, values) {
  return template.replace(PROMPT_VARIABLE_RE, (match, key) => (key in values ? String(values[key] ?? '') : match));
}

/**
 * Переменные шаблона, которых фича не знает (обычно опечатка в имени).
 * @param {string} template - Шаблон промпта.
 * @param {PromptSpec['variables']} variables - Переменные фичи.
 * @returns {string[]} Неизвестные имена без повторов.
 */
export function findUnknownPromptVariables(template, variables) {
  const known = new Set(variables.map((variable) => variable.key));
  return [...new Set([...template.matchAll(PROMPT_VARIABLE_RE)].map(([, key]) => key))].filter((key) => !known.has(key));
}

/**
 * Стандартный промпт фичи в виде шаблона: вместо данных — `{{переменные}}`.
 * @param {PromptSpec} spec
 * @returns {string}
 */
export function buildDefaultPromptTemplate(spec) {
  return spec.buildDefault(Object.fromEntries(spec.variables.map((variable) => [variable.key, `{{${variable.key}}}`])));
}

/**
 * Полный промпт из своего шаблона — тем же minifyPrompt, что и стандартные.
 * @param {string} template - Шаблон промпта.
 * @param {Record<string, any>} values - Значения переменных.
 * @returns {string}
 */
export function buildPromptFromTemplate(template, values) {
  return minifyPrompt(renderPromptTemplate(template, values));
}

/**
 * HTML-предпросмотр шаблона для окон «Системный промпт»: текст экранирован, переменные выделены
 * плашками с их названием — в том же стиле, что предпросмотр стандартных промптов.
 * @param {string} template - Шаблон промпта.
 * @param {PromptSpec['variables']} variables - Переменные фичи.
 * @returns {string} HTML для v-html.
 */
export function renderPromptTemplatePreview(template, variables) {
  const labels = Object.fromEntries(variables.map((variable) => [variable.key, variable.label]));
  return escape(template).replace(PROMPT_VARIABLE_RE, (match, key) => {
    const label = labels[key] ?? `неизвестная переменная ${key}`;
    return `<span class="rounded bg-surface-100 dark:bg-surface-800 font-semibold px-1">{ ${escape(label)} }</span>`;
  });
}
