import PrimeVue from 'primevue/config';
import Ripple from 'primevue/ripple';
import Tooltip from 'primevue/tooltip';
import {createApp} from 'vue';

import {collectPageImages} from '../../editorFiles.js';
import primeVueOptions from '../../primeVueOptions.js';
import {showToast} from '../../toastHost/showToast.js';
import {getTaskIdFromUrl, waitForElement} from '../../utils.js';
import EditDescription from './components/EditDescription.vue';

const DESCRIPTION_SELECTOR = '#task-detail-description';
const FILES_SELECTOR = '#task-detail-files';

// Блока файлов у задачи без вложений нет вовсе — Bitrix ставит его сразу после чек-листа
function replaceFilesBlock(freshDocument, descriptionElement) {
  const freshFiles = freshDocument.querySelector(FILES_SELECTOR);
  const liveFiles = document.querySelector(FILES_SELECTOR);
  if (!freshFiles) {
    liveFiles?.remove();
    return;
  }

  const importedFiles = document.importNode(freshFiles, true);
  if (liveFiles) {
    liveFiles.replaceWith(importedFiles);
    return;
  }
  const anchor = descriptionElement.parentElement.querySelector(':scope > .task-detail-checklist') ?? descriptionElement;
  anchor.after(importedFiles);
}

// Отрендерить BBCode в HTML на клиенте нечем, поэтому после сохранения берём готовые блоки описания
// и файлов из свежей копии страницы. Картинки там приходят уже с настоящим src, скриптов внутри нет
// (проверено на портале)
async function refreshTaskBlocks(descriptionElement) {
  try {
    const response = await fetch(window.location.href, {credentials: 'include'});
    if (!response.ok) return false;
    const freshDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
    const freshDescription = freshDocument.querySelector(DESCRIPTION_SELECTOR);
    if (!freshDescription) return false;
    descriptionElement.innerHTML = freshDescription.innerHTML;
    replaceFilesBlock(freshDocument, descriptionElement);
    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
}

export async function editTaskDescription(sessionId) {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  const descriptionElement = await waitForElement(DESCRIPTION_SELECTOR);
  if (!descriptionElement || descriptionElement.dataset.ptsEditDescription) return;
  descriptionElement.dataset.ptsEditDescription = 'true';
  descriptionElement.title = 'Дважды нажмите, чтобы отредактировать описание';

  let isEditing = false;

  function openEditor() {
    if (isEditing) return;
    isEditing = true;

    const container = Object.assign(document.createElement('div'), {
      className: 'js-edit-task-description pts-app',
    });
    descriptionElement.after(container);
    descriptionElement.style.display = 'none';

    const app = createApp(EditDescription, {
      sessionId,
      taskId: ids.taskId,
      pageImages: collectPageImages(descriptionElement),
      async onClose(isSaved) {
        if (isSaved) {
          const isRefreshed = await refreshTaskBlocks(descriptionElement);
          showToast({
            severity: isRefreshed ? 'success' : 'warn',
            summary: 'Описание сохранено',
            detail: isRefreshed ? undefined : 'Обновите страницу, чтобы увидеть новое описание и файлы.',
            life: isRefreshed ? 3000 : 6000,
          });
        }
        app.unmount();
        container.remove();
        descriptionElement.style.display = '';
        isEditing = false;
      },
    });
    app.use(PrimeVue, primeVueOptions);
    app.directive('tooltip', Tooltip);
    app.directive('ripple', Ripple);
    app.mount(container);
  }

  descriptionElement.addEventListener('dblclick', (event) => {
    // Двойной клик по ссылке или картинке — это работа с ними, а не желание править текст
    if (event.target.closest('a, img, .feed-com-file-inline')) return;
    window.getSelection()?.removeAllRanges();
    openEditor();
  });
}
