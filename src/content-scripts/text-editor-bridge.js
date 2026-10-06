// Визуальный BBCode-редактор Bitrix (ui.text-editor, тот же, что в новой карточке задачи) для
// виджетов расширения. Выполняется в main world: редактор — JS-библиотека Bitrix, из isolated world
// до BX не дотянуться. Виджет создаёт контейнер в DOM (он общий для обоих миров), а мост рисует
// в нём редактор и присылает обратно текст при каждом изменении.
//
// Ключи сообщений продублированы в src/js/textEditorBridge.js — это контракт двух миров.
(() => {
  const MOUNT_KEY = 'PTS_TEXT_EDITOR_MOUNT';
  const MOUNT_RESULT_KEY = 'PTS_TEXT_EDITOR_MOUNT_RESULT';
  const SET_TEXT_KEY = 'PTS_TEXT_EDITOR_SET_TEXT';
  const DESTROY_KEY = 'PTS_TEXT_EDITOR_DESTROY';
  const CHANGE_KEY = 'PTS_TEXT_EDITOR_CHANGE';
  const SET_EDITABLE_KEY = 'PTS_TEXT_EDITOR_SET_EDITABLE';
  const GET_TEXT_KEY = 'PTS_TEXT_EDITOR_GET_TEXT';
  const TEXT_RESULT_KEY = 'PTS_TEXT_EDITOR_TEXT_RESULT';

  // Copilot, упоминания, картинки и файлы требуют своей настройки (селектор пользователей,
  // загрузчик Диска), без неё кнопки были бы нерабочими
  const PLUGINS = [
    'RichText', 'Paragraph', 'Clipboard', 'Bold', 'Underline', 'Italic', 'Strikethrough', 'TabIndent',
    'List', 'Link', 'AutoLink', 'Quote', 'Code', 'Table', 'Spoiler', 'History', 'BlockToolbar',
    'FloatingToolbar', 'Toolbar', 'Placeholder',
  ];
  const TOOLBAR = [
    'bold', 'italic', 'underline', 'strikethrough', '|',
    'numbered-list', 'bulleted-list', '|',
    'link', 'quote', 'code', 'table', 'spoiler',
  ];

  if (window.__ptsTextEditorBridgeReady) return;
  window.__ptsTextEditorBridgeReady = true;

  const editors = new Map();
  // Удалённые до конца монтирования: isolated world не дождался ответа и отказался от редактора,
  // а библиотека догрузилась позже — такой редактор создавать уже не для кого
  const cancelledEditorIds = new Set();

  // Редактор всегда оборачивает абзацы в [p]…[/p]. Классическая карточка задачи и старые описания
  // живут без этого тега, поэтому абзац превращаем в текст с пустой строкой после — так он и выглядел
  function toClassicBbCode(text) {
    return text
      .replace(/\[p\]\n?/gi, '')
      .replace(/\n?\[\/p\]/gi, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function readText(editor) {
    return editor.isEmpty() ? '' : toClassicBbCode(editor.getText());
  }

  function post(message) {
    window.postMessage(message, window.location.origin);
  }

  async function mount({editorId, containerId, content, placeholder, minHeight, maxHeight}) {
    if (!window.BX?.Runtime?.loadExtension) throw new Error('BX.Runtime недоступен');
    await window.BX.Runtime.loadExtension('ui.text-editor');

    if (cancelledEditorIds.delete(editorId)) throw new Error('Редактор отменён до монтирования');

    const BasicEditor = window.BX.UI?.TextEditor?.BasicEditor;
    if (!BasicEditor) throw new Error('ui.text-editor не загрузился');

    const container = document.getElementById(containerId);
    if (!container) throw new Error('Контейнер редактора не найден');

    const editor = new BasicEditor({
      content: content ?? '',
      placeholder: placeholder ?? '',
      minHeight: minHeight ?? 120,
      maxHeight: maxHeight ?? 400,
      plugins: PLUGINS,
      toolbar: TOOLBAR,
    });
    editor.renderTo(container);

    const entry = {editor, lastText: toClassicBbCode(editor.getText())};
    editors.set(editorId, entry);

    // Lexical зовёт слушателя и на смену выделения — шлём только когда текст правда изменился
    editor.getLexicalEditor().registerUpdateListener(() => {
      const text = readText(editor);
      if (text === entry.lastText) return;
      entry.lastText = text;
      post({key: CHANGE_KEY, editorId, text});
    });
  }

  window.addEventListener('message', async (event) => {
    // Только собственное окно и собственный origin: слушатель управляет редактором на странице
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;

    if (data?.key === MOUNT_KEY) {
      let error = null;
      try {
        await mount(data);
      } catch (caught) {
        error = caught?.message || String(caught);
      }
      post({key: MOUNT_RESULT_KEY, editorId: data.editorId, error});
      return;
    }

    const entry = editors.get(data?.editorId);
    if (!entry) {
      if (data?.key === DESTROY_KEY && data.editorId) cancelledEditorIds.add(data.editorId);
      return;
    }

    if (data.key === GET_TEXT_KEY) {
      post({key: TEXT_RESULT_KEY, editorId: data.editorId, requestId: data.requestId, text: readText(entry.editor)});
    } else if (data.key === SET_TEXT_KEY) {
      const text = String(data.text ?? '');
      if (text === entry.lastText) return;
      // Запоминаем до setText: слушатель обновления не должен отсылать этот же текст обратно
      entry.lastText = text;
      entry.editor.setText(text);
    } else if (data.key === SET_EDITABLE_KEY) {
      entry.editor.setEditable(Boolean(data.editable));
    } else if (data.key === DESTROY_KEY) {
      entry.editor.destroy();
      editors.delete(data.editorId);
    }
  });
})();
