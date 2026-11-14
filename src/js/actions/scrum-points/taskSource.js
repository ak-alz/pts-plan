import { getTaskUrl } from '../../utils.js';

// Откуда таблица баллов берёт колонки, задачи и список исполнителей. Источника два — канбан группы
// и личные колонки «Моего плана»; таблице всё равно, какой из них перед ней: оба отдают одно и то же.
//
// Источник:
// - settingsStorageKey — ключ настроек таблицы в chrome.storage.local;
// - load(stageIds) — данные для таблицы одним вызовом: `stages` — колонки в сыром виде
//   task.stages.get, `tasks` — незавершённые задачи (`stageId` у каждой — колонка источника),
//   `members` — кого можно выбрать в настройках помимо исполнителей загруженных задач (сырые
//   объекты user.get); `stageIds` — колонки, выбранные в настройках;
// - getTaskUrl(taskId, taskGroupId?) — адрес задачи.

/**
 * Канбан группы.
 * @param {import('../../BitrixApi.js').default} bitrixApi
 * @param {string} groupId
 * @returns {object} Источник — см. описание в начале файла.
 */
export function createGroupSource(bitrixApi, groupId) {
  return {
    settingsStorageKey: `scrum-points-settings-${groupId}`,
    async load(stageIds) {
      const [stagesResponse, tasks, members] = await Promise.all([
        bitrixApi.getStages(groupId),
        bitrixApi.getAllTasksByStages(stageIds, groupId),
        bitrixApi.getGroupUsers(groupId),
      ]);
      return { stages: Object.values(stagesResponse.data.result), tasks, members };
    },
    getTaskUrl: (taskId, taskGroupId) => getTaskUrl(taskGroupId ?? groupId, taskId),
  };
}

/**
 * Личные колонки «Моего плана» текущего пользователя.
 * @param {import('../../BitrixApi.js').default} bitrixApi
 * @param {string} userId - Текущий пользователь: чужой личный план Bitrix не отдаёт.
 * @returns {object} Источник — см. описание в начале файла.
 */
export function createPersonalSource(bitrixApi, userId) {
  return {
    // Отдельное пространство имён: иначе настройки схлопнулись бы с группой с тем же числовым ID
    settingsStorageKey: `scrum-points-settings-personal-${userId}`,
    async load() {
      // Стадии «Моего плана» Bitrix отдаёт только по entityId = 0 — «текущий пользователь»
      const stages = Object.values((await bitrixApi.getStages(0)).data.result);
      // Задачи берём из всех личных колонок, а не только из выбранных: участников у личного плана
      // нет, и список исполнителей для настроек собирается из самих задач. По выбранным колонкам
      // в нём не оказалось бы тех, чьи задачи сейчас лежат в остальных
      const tasks = await bitrixApi.getPersonalPlanTasksByStages(stages.map((stage) => stage.ID), userId);

      return {
        stages,
        // stageId задачи — колонка канбана её группы, таблице же нужна личная
        tasks: tasks.map((task) => ({ ...task, stageId: task.personalStageId })),
        members: [],
      };
    },
    // На личном плане Bitrix открывает задачи через раздел пользователя, даже если у задачи есть группа
    getTaskUrl: (taskId) => getTaskUrl(null, taskId, userId),
  };
}
