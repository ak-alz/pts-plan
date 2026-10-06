// Isolated-сторона моста к сетке канбана Bitrix. Сам мост — src/content-scripts/kanban-bridge.js,
// инжектится в main world при первом обращении.
import {loadMainWorldScript} from './mainWorldScript.js';

const REFRESH_TASK_KEY = 'PTS_KANBAN_REFRESH_TASK';

/**
 * Добавляет на открытую доску канбана карточку задачи, созданной в обход формы Bitrix (через REST).
 * Сетка сама запрашивает карточку и ставит её в колонку стадии задачи; если карточка уже есть или
 * сетки на странице нет — ничего не делает.
 * @param {string|number} taskId
 * @returns {Promise<void>}
 */
export async function refreshKanbanTask(taskId) {
  if (!taskId || !await loadMainWorldScript('src/content-scripts/kanban-bridge.js')) return;
  window.postMessage({key: REFRESH_TASK_KEY, taskId: String(taskId)}, window.location.origin);
}
