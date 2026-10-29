// Отдельный модуль ради справочных значений нейросетей: их читает и реестр опций (src/js/options.js),
// и попап, и сам клиент Пиксель Тулс. Держать их в PixelToolsApi.js значило бы тащить в бандл попапа
// весь клиент вместе с backgroundFetch и хостом уведомлений

/**
 * Значение опции `pixelToolsAiModel`, означающее «нейросеть, предвыбранная в самом Пиксель Тулс».
 * Конкретную модель здесь не храним: состав зависит от тарифа ключа и меняется на стороне сервиса
 * без предупреждения, поэтому нужное значение берётся из справочника перед каждым запросом
 * (см. `getAiModels()` в `PixelToolsApi.js`).
 */
export const DEFAULT_MODEL_VALUE = 'default';

/**
 * Лимит длины запроса для нейросети, у которой в справочнике `promptLength: 0`, — общий предел
 * метода `/aicontent` по документации Пиксель Тулс.
 */
export const DEFAULT_PROMPT_LENGTH = 10000;

/**
 * Сколько символов запроса принимает нейросеть из справочника `getAiModels()`.
 * @param {{promptLength?: number}} aiModel - Нейросеть из справочника.
 * @returns {number} Лимит в символах: свой у модели или общий `DEFAULT_PROMPT_LENGTH`.
 */
export function getModelPromptLength(aiModel) {
  return aiModel.promptLength || DEFAULT_PROMPT_LENGTH;
}
