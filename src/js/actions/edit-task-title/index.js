import BitrixApi from '../../BitrixApi.js';
import { getTaskIdFromUrl, insertCSS } from '../../utils.js';

export async function editTaskTitle(sessionId) {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const titleBlock = document.querySelector('.ui-toolbar-title-item-box');
  const titleEl = titleBlock?.querySelector('.ui-toolbar-title-item');
  if (!titleEl || titleEl.dataset.editInitialized) return;

  insertCSS(`
    .ui-toolbar-title-item[data-edit-ready] {
      cursor: text;
    }
    .ui-toolbar-title-item[contenteditable="true"] {
      outline: none;
      border-bottom: 2px solid #6366f1;
      min-width: 60px;
      white-space: nowrap;
    }
    .ui-toolbar-title-item[data-saving="true"] {
      opacity: 0.6;
      pointer-events: none;
    }
  `);

  titleEl.dataset.editInitialized = 'true';
  titleEl.dataset.editReady = 'true';
  titleEl.title = 'Нажмите, чтобы переименовать задачу (Enter — сохранить, Esc — отменить)';

  const api = new BitrixApi(sessionId);
  let originalTitle = '';

  function startEdit() {
    if (titleEl.contentEditable === 'true') return;
    originalTitle = titleEl.textContent.trim();
    titleEl.contentEditable = 'true';
    titleEl.focus();
    const range = document.createRange();
    range.selectNodeContents(titleEl);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function commitEdit() {
    if (titleEl.contentEditable !== 'true') return;
    const newTitle = titleEl.textContent.trim();
    titleEl.contentEditable = 'false';

    if (!newTitle || newTitle === originalTitle) {
      titleEl.textContent = originalTitle;
      return;
    }

    titleEl.dataset.saving = 'true';
    try {
      await api.updateTask(ids.taskId, { TITLE: newTitle });
      originalTitle = newTitle;
    } catch (e) {
      titleEl.textContent = originalTitle;
      console.error('[edit-task-title] save failed', e);
    } finally {
      delete titleEl.dataset.saving;
    }
  }

  function cancelEdit() {
    if (titleEl.contentEditable !== 'true') return;
    titleEl.contentEditable = 'false';
    titleEl.textContent = originalTitle;
  }

  titleEl.addEventListener('click', (e) => {
    if (titleEl.contentEditable === 'true') return;
    e.stopPropagation();
    startEdit();
  });

  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });

  titleEl.addEventListener('blur', () => {
    commitEdit();
  });

  // Запрет переноса строки при paste
  titleEl.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/\n/g, ' ');
    document.execCommand('insertText', false, text);
  });
}
