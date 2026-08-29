import BitrixApi from './BitrixApi.js';
import {getGroupIdFromUrl, getPersonalPlanUserIdFromUrl} from './utils.js';

// Паузы перед повторами user.current. Запрос дешёвый, но от него зависят сразу все виджеты личного
// плана: они стартуют одновременно и ждут один общий промис, так что разовая сетевая осечка без
// повтора погасила бы их все разом
const CURRENT_USER_RETRY_DELAYS = [500, 2000];

let currentUserIdPromise = null;

/**
 * Запрашивает id текущего пользователя, повторяя попытку при сбое.
 * @param {string} sessionId
 * @returns {Promise<string|null>} id пользователя либо null, если Bitrix вернул пустой ответ.
 */
async function fetchCurrentUserId(sessionId) {
  const bitrixApi = new BitrixApi(sessionId);

  for (let attempt = 0; ; attempt++) {
    try {
      const user = await bitrixApi.getCurrentUser();
      return user?.ID ? String(user.ID) : null;
    } catch (error) {
      if (attempt >= CURRENT_USER_RETRY_DELAYS.length) throw error;
      await new Promise((resolve) => { setTimeout(resolve, CURRENT_USER_RETRY_DELAYS[attempt]); });
    }
  }
}

/**
 * Определяет контекст канбана текущей страницы: групповой канбан либо личный план («Мой план»)
 * текущего пользователя. Для личного плана дополнительно сверяет userId из адреса с реально
 * авторизованным пользователем — Bitrix всегда отдаёт стадии/задачи ТЕКУЩЕГО пользователя
 * независимо от чужого userId в URL, так что без этой проверки виджет показывал бы данные не
 * того человека, чью страницу открыли.
 * @param {string} sessionId
 * @returns {Promise<{type: 'group'|'personal', id: string}|null>}
 */
export async function resolveKanbanContext(sessionId) {
  const groupId = getGroupIdFromUrl(window.location.href);
  if (groupId) return {type: 'group', id: groupId};

  const personalUserId = getPersonalPlanUserIdFromUrl(window.location.href);
  if (!personalUserId) return null;

  // Промис общий на все фичи страницы, чтобы user.current запрашивался один раз, а не по разу на
  // виджет. Отказ из кеша выбрасываем: иначе даже пережившая все повторы ошибка запомнилась бы
  // до перезагрузки страницы, и фича, поднявшаяся позже остальных, не получила бы ни шанса
  if (!currentUserIdPromise) {
    currentUserIdPromise = fetchCurrentUserId(sessionId).catch((error) => {
      currentUserIdPromise = null;
      throw error;
    });
  }
  const currentUserId = await currentUserIdPromise;

  return currentUserId === personalUserId ? {type: 'personal', id: personalUserId} : null;
}
