import {getTaskIdFromUrl, insertCSS, rehydrateOnChanges, waitForElement} from '../../utils.js';

async function redirectAfterTaskCreate() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('EVENT_TYPE') !== 'ADD') return;

  const taskId = url.searchParams.get('EVENT_TASK_ID');
  if (!taskId) return;

  // Эта страница — прямой ответ на POST формы создания задачи (Bitrix не делает серверный
  // редирект на чистый GET). Пока ждём BACKURL ниже, текущая запись в истории остаётся
  // «POST-страницей» — обновление или переход назад в это время просит подтвердить повторную
  // отправку формы. replaceState() гасит это сразу, до ожидания
  window.history.replaceState(null, '', url.href);

  // BACKURL — то же скрытое поле формы tasks.task.edit, которое Bitrix сам использует
  // для редиректа в iframe-версии (шаблон с плейсхолдерами #action#/#task_id#).
  // Bitrix подставляет поля этой формы асинхронно, поэтому его может не быть в момент запуска.
  const backUrlInput = await waitForElement('input[name="BACKURL"]');
  if (!backUrlInput?.value) return;

  const viewUrl = backUrlInput.value
    .replace('#action#', 'view')
    .replace('#task_id#', taskId);

  window.location.replace(viewUrl);
}

function scrollUserLists() {
  const ids = getTaskIdFromUrl(window.location.href);
  if (!ids?.taskId) return;

  // .task-detail-sidebar-info-users-list — общий класс Bitrix для блоков «Соисполнители»
  // и «Наблюдатели» в сайдбаре задачи; у одиночных «Постановщик»/«Исполнитель» его нет.
  insertCSS(`
    .task-detail-sidebar-info-users-list {
      max-height: 500px;
      overflow-y: auto;
    }
    .task-detail-sidebar-info-user-del {
      right: 0 !important;
    }
  `, 'pts-scroll-user-lists');
}

// Окно «Редактирование рабочего дня» Bitrix позиционирует до того, как в него дорисуются
// циферблаты, поэтому оно уезжает за край экрана и обрезается. Событие resize заставляет
// BX.PopupWindow пересчитать положение по итоговым размерам
const TIMEMAN_POPUP_SELECTOR = '[id^="timeman_edit_popup"]';

function fixTimemanPopupPosition() {
  const positionedPopups = new WeakSet();

  function repositionPopup() {
    const popups = document.querySelectorAll(TIMEMAN_POPUP_SELECTOR);
    if (!popups.length) return;

    let needsResize = false;

    for (const popup of popups) {
      const {width, height} = popup.getBoundingClientRect();

      // Закрытое окно даёт нулевые размеры — снимаем метку, чтобы починить его при следующем показе
      if (!width || !height) {
        positionedPopups.delete(popup);
        continue;
      }

      // Пересчёт меняет style окна, что снова разбудит наблюдатель — метка гасит цикл
      if (positionedPopups.has(popup)) continue;

      positionedPopups.add(popup);
      needsResize = true;
    }

    if (!needsResize) return;

    window.dispatchEvent(new Event('resize'));
  }

  rehydrateOnChanges(repositionPopup, document.body, {
    attributes: ['class', 'style'],
    // Кэшированное окно Bitrix открывает повторно сменой style/class, а не вставкой в DOM,
    // поэтому смотрим и на атрибуты — но только у самого окна
    filterMutation: (mutation) => {
      if (mutation.type === 'attributes') {
        return !!mutation.target.matches?.(TIMEMAN_POPUP_SELECTOR);
      }

      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(TIMEMAN_POPUP_SELECTOR)) return true;
      }

      return false;
    },
  });
}

export function bitrixBugfixes(options = {}) {
  if (options.bitrixBugfixesRedirectAfterTaskCreate) {
    redirectAfterTaskCreate();
  }

  if (options.bitrixBugfixesScrollUserLists) {
    scrollUserLists();
  }

  if (options.bitrixBugfixesTimemanPopupPosition) {
    fixTimemanPopupPosition();
  }
}
