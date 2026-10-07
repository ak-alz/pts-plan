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
  const INSERT_FILE_KEY = 'PTS_TEXT_EDITOR_INSERT_FILE';
  const REMOVE_FILE_KEY = 'PTS_TEXT_EDITOR_REMOVE_FILE';

  // Copilot, упоминания и внешние картинки требуют своей настройки (селектор пользователей и т. п.),
  // без неё кнопки были бы нерабочими. Файлы Диска (плагин File) включаются отдельно — только когда
  // виджет передал сведения о файлах, без них плагин не знает, что рисовать
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

  // Теги, которые понимают подключённые плагины. [DISK FILE] — отдельно: только файлы, о которых плагин
  // File знает (иначе он рисует пустышку и теряет ID). Остальные редактор портит (проверено на портале):
  // [DISK FILE ID=…] превращается в пустой [disk] без ID, [COLOR]/[SIZE] — в жирный, [FONT]/[CENTER]
  // пропадают, [USER]/[IMG] и прочие экранируются. Поэтому чужие теги отдаём ему уже экранированными —
  // он покажет их обычным текстом и вернёт как есть
  const SUPPORTED_TAGS = new Set([
    'b', 'i', 'u', 's', 'url', 'code', 'quote', 'spoiler', 'table', 'tr', 'td', 'th', 'list', '*', 'p',
  ]);
  const TAG_RE = /\[(\/?)([a-z*]+)([^\]]*)\]/gi;

  const DISK_FILE_ID_RE = /\bID\s*=\s*([\w]+)/i;

  function isSupportedTag(name, rest, fileIds) {
    if (name.toLowerCase() === 'disk') return fileIds.has(rest.match(DISK_FILE_ID_RE)?.[1]?.toLowerCase());
    return SUPPORTED_TAGS.has(name.toLowerCase());
  }

  function escapeUnsupportedTags(text, fileIds) {
    return String(text ?? '').replace(TAG_RE, (tag, slash, name, rest) => (isSupportedTag(name, rest, fileIds)
      ? tag
      : `&#91;${slash}${name}${rest}&#93;`));
  }

  // Любую квадратную скобку вне тегов редактор сохраняет HTML-сущностью: и экранированные выше теги,
  // и обычный текст вроде «[скобки]». В описании задачи такая сущность так и осталась бы — возвращаем скобки
  function restoreBrackets(text) {
    return text.replace(/&#91;/g, '[').replace(/&#93;/g, ']');
  }

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
    return editor.isEmpty() ? '' : restoreBrackets(toClassicBbCode(editor.getText()));
  }

  function post(message) {
    window.postMessage(message, window.location.origin);
  }

  async function mount({editorId, containerId, content, placeholder, minHeight, maxHeight, files}) {
    if (!window.BX?.Runtime?.loadExtension) throw new Error('BX.Runtime недоступен');
    await window.BX.Runtime.loadExtension('ui.text-editor');

    if (cancelledEditorIds.delete(editorId)) throw new Error('Редактор отменён до монтирования');

    const BasicEditor = window.BX.UI?.TextEditor?.BasicEditor;
    if (!BasicEditor) throw new Error('ui.text-editor не загрузился');

    const container = document.getElementById(containerId);
    if (!container) throw new Error('Контейнер редактора не найден');

    // ID файлов — как они записаны в тегах описания: n123 (объект Диска) или 456 (вложение задачи)
    const fileIds = new Set((files ?? []).map((file) => String(file.serverFileId).toLowerCase()));
    const editor = new BasicEditor({
      content: escapeUnsupportedTags(content, fileIds),
      placeholder: placeholder ?? '',
      minHeight: minHeight ?? 120,
      maxHeight: maxHeight ?? 400,
      plugins: files ? [...PLUGINS, 'File'] : PLUGINS,
      toolbar: TOOLBAR,
      ...(files ? {file: {mode: 'disk', files}} : {}),
    });
    editor.renderTo(container);

    const entry = {editor, fileIds, lastText: readText(editor)};
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
      entry.editor.setText(escapeUnsupportedTags(text, entry.fileIds));
    } else if (data.key === INSERT_FILE_KEY) {
      const command = window.BX.UI?.TextEditor?.Plugins?.File?.INSERT_FILE_COMMAND;
      if (!command || !data.info?.serverFileId) return;
      entry.fileIds.add(String(data.info.serverFileId).toLowerCase());
      entry.editor.getLexicalEditor().dispatchCommand(command, {serverFileId: data.info.serverFileId, info: data.info});
    } else if (data.key === REMOVE_FILE_KEY) {
      const command = window.BX.UI?.TextEditor?.Plugins?.File?.REMOVE_FILE_COMMAND;
      if (!command || !data.serverFileId) return;
      entry.editor.getLexicalEditor().dispatchCommand(command, {serverFileId: data.serverFileId});
      entry.fileIds.delete(String(data.serverFileId).toLowerCase());
    } else if (data.key === SET_EDITABLE_KEY) {
      entry.editor.setEditable(Boolean(data.editable));
    } else if (data.key === DESTROY_KEY) {
      entry.editor.destroy();
      editors.delete(data.editorId);
    }
  });
})();
