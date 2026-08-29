import { ref, watch } from 'vue';

// Один запрос на страницу: на личном канбане селект группы есть сразу у нескольких виджетов,
// и без общего кеша каждый дёргал бы sonet_group.user.groups отдельно. Отказ из кеша
// выбрасываем — иначе разовая осечка запомнилась бы до перезагрузки страницы
let userGroupsPromise = null;

/**
 * @param {import('../BitrixApi.js').default} bitrixApi
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
function loadUserGroups(bitrixApi) {
  if (!userGroupsPromise) {
    userGroupsPromise = bitrixApi.getUserGroups().catch((error) => {
      userGroupsPromise = null;
      throw error;
    });
  }
  return userGroupsPromise;
}

/**
 * Фильтр по группе для виджетов на личном плане. В «Мой план» попадают задачи из разных групп,
 * и статистику бывает нужно сузить до одной — а бывает и нет, поэтому пустое значение означает
 * «все группы» и является поведением по умолчанию.
 *
 * Список групп берётся из `sonet_group.user.groups`: один дешёвый запрос, доступный ещё до
 * загрузки задач. Собирать группы из самих задач было бы точнее (в личный план может попасть
 * задача группы, участником которой пользователь не числится), но потребовало бы сначала
 * выкачать весь план целиком — а такие задачи всё равно попадают в выдачу при пустом фильтре.
 *
 * @param {import('../BitrixApi.js').default} bitrixApi
 * @param {string} storageKey - Ключ `chrome.storage.local`, под которым запоминается выбор.
 * @returns {{groupOptions: import('vue').Ref<Array<{id: string, name: string}>>,
 *   selectedGroupId: import('vue').Ref<string|null>, restoreGroupFilter: () => Promise<void>}}
 */
export function usePersonalGroupFilter(bitrixApi, storageKey) {
  const groupOptions = ref([]);
  const selectedGroupId = ref(null);
  let isRestored = false;

  async function restoreGroupFilter() {
    const [groups, stored] = await Promise.all([
      loadUserGroups(bitrixApi).catch(() => []),
      chrome.storage.local.get([storageKey]),
    ]);

    groupOptions.value = groups;
    // Сохранённой группы могло не стать — вывели из состава, удалили
    const savedGroupId = stored[storageKey];
    selectedGroupId.value = groups.some((group) => group.id === savedGroupId) ? savedGroupId : null;
    isRestored = true;
  }

  // Пишем только после восстановления, иначе первое же присваивание внутри restoreGroupFilter()
  // записало бы обратно то, что только что прочитали
  watch(selectedGroupId, (groupId) => {
    if (!isRestored) return;
    chrome.storage.local.set({ [storageKey]: groupId });
  });

  return { groupOptions, selectedGroupId, restoreGroupFilter };
}
