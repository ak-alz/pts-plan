// Встроенный в Chrome (138+) on-device перевод: без ключей и запросов на сторонние хосты.
// Языковой пакет скачивает сам браузер при первом создании переводчика, поэтому экземпляр
// кэшируется на весь сеанс страницы.
let translatorPromise = null;

function createTranslator() {
  const translatorApi = globalThis.Translator;
  if (!translatorApi?.create) return Promise.resolve(null);
  return translatorApi.create({ sourceLanguage: 'ru', targetLanguage: 'en' }).catch(() => null);
}

/**
 * Переводит текст с русского на английский встроенным переводчиком Chrome.
 * @param {string} text Текст на русском
 * @returns {Promise<string|null>} Перевод или `null`, если переводчик недоступен (старый Chrome,
 * не установлен языковой пакет, ошибка перевода) — вызывающий код должен предусмотреть запасной вариант
 */
export async function translateRuToEn(text) {
  if (!text) return null;

  translatorPromise ??= createTranslator();
  const translator = await translatorPromise;
  if (!translator) return null;

  try {
    return (await translator.translate(text)).trim();
  } catch {
    return null;
  }
}
