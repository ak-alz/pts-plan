// Данные, которых у личного канбана «Мой план» нет как сущности и которые приходится собирать
// из других источников. Списка участников и своего набора колонок у него не существует:
// `sonet_group.user.get` отвечает «Socialnetwork group not found», а стадии «Моего плана»
// (`entityId: 0`, `ENTITY_TYPE: 'U'`) к задачам не привязаны — у задачи в личном плане STAGE_ID
// указывает на канбан её собственной группы.

/**
 * Собирает колонки канбанов нескольких групп в один список.
 * Когда в списке колонки больше чем одной группы, к названию приписывается группа — иначе их не
 * различить, «Готово» есть в каждом канбане. Если группа в списке одна, подпись только мешает.
 * @param {import('./BitrixApi.js').default} bitrixApi
 * @param {string[]} groupIds - Группы, чьи канбаны нужны.
 * @param {Set<string>|null} [usedStageIds] - Если передан, останутся только эти колонки. Нужен,
 * когда список строится по конкретной выборке задач: иначе в него попали бы все колонки подряд.
 * @returns {Promise<Array<{id: string, title: string, groupName: string, name: string, color: string}>>}
 * Колонки, сгруппированные по названию группы и упорядоченные внутри неё по порядку канбана.
 */
export async function collectStagesFromGroups(bitrixApi, groupIds, usedStageIds = null) {
  if (!groupIds.length) return [];

  // Название группы приписывается к каждой колонке. Если запрос не удался, обойдёмся без него —
  // список колонок всё равно полезнее пустого
  const [stagesById, groupsById] = await Promise.all([
    bitrixApi.getStagesBatch(groupIds),
    bitrixApi.getGroupsByIdsBatch(groupIds).catch(() => ({})),
  ]);

  const usedStages = Object.values(stagesById)
    .filter((stage) => !usedStageIds || usedStageIds.has(String(stage.ID)));

  // Считаем группы по итоговому списку, а не по groupIds: часть групп могла не дать ни одной
  // подходящей колонки, и подпись оказалась бы у единственной оставшейся группы
  const hasSeveralGroups = new Set(usedStages.map((stage) => String(stage.ENTITY_ID))).size > 1;

  return usedStages
    .map((stage) => {
      const groupName = groupsById[String(stage.ENTITY_ID)]?.NAME ?? '';
      return {
        id: String(stage.ID),
        // Отдельно от name: в таблицах название колонки и группа могут выводиться разным начертанием
        title: stage.TITLE,
        groupName,
        name: hasSeveralGroups && groupName ? `${stage.TITLE} — ${groupName}` : stage.TITLE,
        color: `#${stage.COLOR}`,
        sort: Number(stage.SORT ?? 0),
      };
    })
    // Сначала по группе, потом по порядку колонок внутри неё: иначе колонки разных канбанов
    // перемешались бы по номеру сортировки
    .sort((a, b) => a.groupName.localeCompare(b.groupName, 'ru') || a.sort - b.sort);
}

/**
 * Колонки, реально проставленные у переданных задач. Годится там, где список строится уже по
 * загруженным данным; если колонки нужны до всякой выгрузки — берите collectStagesFromGroups()
 * по группам пользователя.
 * @param {import('./BitrixApi.js').default} bitrixApi
 * @param {Array<{stageId?: string|number, groupId?: string|number}>} tasks - Задачи из searchMyTasks().
 * @returns {Promise<Array<{id: string, title: string, groupName: string, name: string, color: string}>>}
 */
export async function collectStagesFromTasks(bitrixApi, tasks) {
  const usedStageIds = new Set();
  const groupIds = new Set();

  tasks.forEach((task) => {
    const stageId = String(task.stageId ?? '');
    const groupId = String(task.groupId ?? '0');
    if (!stageId || stageId === '0') return;
    usedStageIds.add(stageId);
    if (groupId !== '0') groupIds.add(groupId);
  });

  return collectStagesFromGroups(bitrixApi, [...groupIds], usedStageIds);
}

/**
 * Раскладывает плоский список колонок по группам для селектов PrimeVue
 * (`option-group-label` / `option-group-children`). Колонки уже отсортированы по группе, поэтому
 * порядок групп берётся из порядка следования.
 * @param {Array<{groupName?: string}>} stages - Результат collectStagesFromGroups/FromTasks.
 * @returns {Array<{groupName: string, stages: Array<object>}>} Одна запись — одна группа.
 */
export function groupStagesByGroup(stages) {
  const byGroupName = new Map();

  stages.forEach((stage) => {
    const groupName = stage.groupName ?? '';
    if (!byGroupName.has(groupName)) byGroupName.set(groupName, { groupName, stages: [] });
    byGroupName.get(groupName).stages.push(stage);
  });

  return [...byGroupName.values()];
}
