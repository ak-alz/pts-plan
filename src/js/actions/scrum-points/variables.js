import {groupBy, orderBy, sumBy} from 'lodash-es';

export const defaultSortColumn = 'visibleTotalPoints';

// Галка «Группировать по родительской задаче» в окнах задач — общая для всех групп
export const GROUP_BY_PARENT_STORAGE_KEY = 'scrum-points-group-by-parent';

/**
 * Задачи окна, сгруппированные по корневой задаче — как в «Истории спринта»: одна строка на корень
 * с суммой баллов, сами задачи — в списке группы. Группы — по убыванию суммы баллов, внутри группы
 * сначала корень (если он среди задач окна), затем остальные по баллам.
 * @param {Array<{id: string, name: string, url: string, points: number}>} tasks - Задачи окна.
 * @param {Map<string, {id: string, title: string, url: string|null}>} rootByTaskId - Корень каждой задачи.
 * @returns {Array<{key: string, name: string, url: string|null, points: number, tasks: object[], hasSubtasks: boolean}>}
 */
export function groupTasksByRoot(tasks, rootByTaskId) {
  const groups = Object.values(groupBy(tasks, (task) => rootByTaskId.get(String(task.id))?.id ?? String(task.id)));

  return orderBy(groups.map((groupTasks) => {
    const firstTask = groupTasks[0];
    const root = rootByTaskId.get(String(firstTask.id)) ?? {id: String(firstTask.id), title: firstTask.name, url: firstTask.url};
    const rootTask = groupTasks.find((task) => String(task.id) === root.id);
    const subtasks = orderBy(groupTasks.filter((task) => task !== rootTask), 'points', 'desc');

    return {
      key: root.id,
      name: root.title,
      url: root.url,
      points: sumBy(groupTasks, 'points'),
      tasks: rootTask ? [rootTask, ...subtasks] : subtasks,
      hasSubtasks: subtasks.length > 0,
    };
  }), ['points'], ['desc']);
}
