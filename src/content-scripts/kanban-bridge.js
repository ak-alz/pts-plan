// Доступ к сетке канбана Bitrix (BX.Tasks.Kanban.Grid) — выполняется в main world, из isolated
// world JS-объект сетки не виден. Нужен, чтобы задача, созданная через REST, сразу появилась на
// доске: Bitrix добавляет карточку сам только после своей формы, а push-события до сетки не доходят.
//
// Ключ сообщения продублирован в src/js/kanbanBridge.js — это контракт двух миров.
(() => {
  const REFRESH_TASK_KEY = 'PTS_KANBAN_REFRESH_TASK';

  if (window.__ptsKanbanBridgeReady) return;
  window.__ptsKanbanBridgeReady = true;

  // Компонент канбана задач кладёт свою сетку в window.Kanban. Проверяем класс: под этим именем
  // на другой странице может оказаться что угодно
  function findGrid() {
    const Grid = window.BX?.Tasks?.Kanban?.Grid;
    return Grid && window.Kanban instanceof Grid ? window.Kanban : null;
  }

  window.addEventListener('message', (event) => {
    // Только собственное окно и собственный origin: слушатель меняет содержимое доски
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.key !== REFRESH_TASK_KEY) return;

    const taskId = String(event.data.taskId ?? '');
    const grid = findGrid();
    if (!taskId || !grid) return;

    // Карточка уже есть — значит, её успело добавить push-событие, второй раз не вставляем
    if (grid.getItem(taskId)) return;
    // Сетка сама запрашивает карточку с сервера и ставит её в колонку текущей стадии задачи
    grid.refreshTask(taskId);
  });
})();
