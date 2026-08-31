// Вставка текста в редактор комментария Bitrix (LHE) — выполняется в main world, потому что из
// isolated world это принципиально недостижимо. Упоминание редактор держит в разметке как
// <span id="bxid123456789">Имя</span>, а сам ID пользователя лежит только в JS-объекте редактора
// (editor.bxTags[id] = {tag, userId, userName}); в DOM его нет. Вставленный руками span при отправке
// не найдёт свою запись в bxTags и уедет в комментарий обычным текстом, без уведомления.
//
// Ключи сообщений продублированы в src/js/commentEditorBridge.js — это контракт двух миров,
// импортировать общий модуль в main world незачем.
(() => {
  const REQUEST_KEY = 'PTS_EDITOR_INSERT';
  const RESPONSE_KEY = 'PTS_EDITOR_INSERT_RESULT';

  if (window.__ptsEditorBridgeReady) return;
  window.__ptsEditorBridgeReady = true;

  // formId постформы — это id одного из DOM-предков формы, поэтому isolated world присылает их все
  function findHandler(formIds) {
    for (const formId of formIds) {
      const handler = window.LHEPostForm?.getHandlerByFormId?.(formId);
      if (handler) return handler;
    }
    return null;
  }

  function insertText(formIds, text) {
    const handler = findHandler(formIds);
    if (!handler) return 'Форма комментария Bitrix не найдена';

    const editor = handler.getEditor?.();
    if (!editor) return 'Редактор комментария ещё не инициализирован';

    // Повторный клик — текст уже в поле. GetContent() отдаёт содержимое в BBCode независимо от
    // режима, так что сравнивать можно прямо с тем, что собираемся вставить
    if (editor.GetContent().includes(text)) return null;

    // В визуальном режиме нужен HTML, собранный самим редактором: его BBCode-парсер попутно
    // регистрирует упоминание в editor.bxTags. В режиме BBCode insertContent положит в textarea
    // исходный текст, и второй аргумент не понадобится.
    //
    // Именно bbParser.Parse(), а не ParseContentFromBbCode(): та следом прогоняет результат через
    // editor.Parse(content, true, true), а он заменяет узлы с bxTag на плейсхолдер `~bxid…~` и
    // восстанавливает их только через реестр суррогатов (GetBxNode). Упоминания в том реестре нет —
    // оно живёт в specialParsers, — и плейсхолдер вырезался вместе с именем. Сам Bitrix при
    // переносе BBCode в визуальный режим тоже обходится одним bbParser.Parse()
    const html = editor.GetViewMode() === 'wysiwyg' ? editor.bbParser?.Parse(text) ?? text : null;
    handler.insertContent(text, html);
    return null;
  }

  window.addEventListener('message', (event) => {
    // Только собственное окно и собственный origin: слушатель правит содержимое формы комментария
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.key !== REQUEST_KEY) return;

    const {requestId, formIds, text} = event.data;

    let error;
    try {
      error = insertText(Array.isArray(formIds) ? formIds : [], String(text ?? ''));
    } catch (caught) {
      error = caught?.message || String(caught);
    }

    window.postMessage({key: RESPONSE_KEY, requestId, error}, window.location.origin);
  });
})();
