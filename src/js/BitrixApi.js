import axios from 'axios';

// Паузы перед повторами, когда Bitrix просит сбавить темп. Длинные не случайно:
// QUERY_LIMIT_EXCEEDED (503) — слишком частые запросы, OPERATION_TIME_LIMIT (429) — исчерпан лимит
// ресурсоёмкости, после которого метод блокируется на 10 минут, так что короткий повтор бесполезен.
const RATE_LIMIT_RETRY_DELAYS = [3000, 10000, 30000];

// Повторов по отдельным командам батча меньше, и они короче: requestWithRateLimitRetry уже
// отработал свои паузы на весь запрос, а здесь повторяется небольшой остаток команд, причём
// последовательно. Без урезания суммарное ожидание одного вызова доходило бы до трёх минут
const PER_COMMAND_RETRY_DELAYS = RATE_LIMIT_RETRY_DELAYS.slice(0, 2);

const RATE_LIMIT_ERROR_CODES = ['QUERY_LIMIT_EXCEEDED', 'OPERATION_TIME_LIMIT'];

/** Текст для пользователя, когда повторы кончились: из «Request failed with status code 503» непонятно, что делать. */
const RATE_LIMIT_ERROR_MESSAGE = 'Bitrix ограничил частоту запросов и не отдал данные. Подождите несколько минут и повторите — или сузьте период.';

function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// Больше 50 команд за раз batch.json не принимает
const BATCH_COMMAND_LIMIT = 50;

/**
 * Режет карту команд batch.json на порции допустимого размера.
 * @param {Record<string, string>} commands - Карта «ключ команды → метод?параметры».
 * @returns {Array<Record<string, string>>}
 */
function chunkBatchCommands(commands) {
  const entries = Object.entries(commands);
  const chunks = [];
  for (let start = 0; start < entries.length; start += BATCH_COMMAND_LIMIT) {
    chunks.push(Object.fromEntries(entries.slice(start, start + BATCH_COMMAND_LIMIT)));
  }
  return chunks;
}

/**
 * Похож ли ответ (или ошибка axios) на ограничение интенсивности запросов Bitrix.
 * @param {any} data - Тело ответа Bitrix (`{error, error_description}`) либо элемент result_error батча.
 * @param {number} [status] - HTTP-статус ответа.
 * @returns {boolean}
 */
function isRateLimitResponse(data, status) {
  if (status === 503 || status === 429) return true;
  // У ответа метода код лежит в `error` строкой, у элемента result_error батча — объектом с тем же полем
  const rawError = data?.error;
  const code = String((rawError && typeof rawError === 'object' ? rawError.error : rawError) ?? '');
  return RATE_LIMIT_ERROR_CODES.includes(code);
}

const DEFAULT_TASK_SELECT_FIELDS = [
  'ID', 'TITLE', 'RESPONSIBLE_ID', 'CREATED_DATE', 'CHANGED_DATE', 'CLOSED_DATE',
  'GROUP_ID', 'STAGE_ID', 'FAVORITE', 'PARENT_ID',
];

/**
 * Собирает объект `filter` для tasks.task.list из именованных параметров поиска задач.
 * Вынесен из searchTasks, чтобы тем же фильтром пользовался countTasksBatch.
 * @param {Object} params - те же параметры, что принимает searchTasks (см. его JSDoc).
 * @returns {Record<string, any>} Объект фильтра в терминах Bitrix.
 */
function buildTasksFilter({
  ids,
  favorite,
  title,
  smartTitleSearch,
  excludeTitle,
  status,
  parentType,
  parentIds,
  groupId,
  createdBy,
  responsibleId,
  responsibleOrCreatedBy,
  accompliceId,
  auditorId,
  stageIds,
  createdDateFrom,
  createdDateTo,
  changedDateFrom,
  changedDateTo,
  closedDateFrom,
  closedDateTo,
}) {
  const filter = {};
  if (ids?.length) filter['ID'] = ids;
  if (favorite) filter['::SUBFILTER-PARAMS'] = {FAVORITE: 'Y'};
  if (title) {
    const words = smartTitleSearch ? title.trim().split(/\s+/).filter(Boolean) : [];
    if (words.length > 1) {
      filter['::LOGIC'] = 'AND';
      words.forEach((word, i) => {
        filter[`::SUBFILTER-w${i}`] = {'%TITLE': word};
      });
    } else {
      filter['%TITLE'] = title;
    }
  }

  const excludeWords = excludeTitle ? excludeTitle.trim().split(/\s+/).filter(Boolean) : [];
  if (excludeWords.length) {
    if (!filter['::LOGIC']) filter['::LOGIC'] = 'AND';
    if (filter['%TITLE']) {
      filter['::SUBFILTER-title'] = {'%TITLE': filter['%TITLE']};
      delete filter['%TITLE'];
    }
    excludeWords.forEach((word, i) => {
      filter[`::SUBFILTER-ex${i}`] = {'!%TITLE': word};
    });
  }
  if (status === 'active') filter['!STATUS'] = 5;
  if (status === 'closed') filter['STATUS'] = 5;
  if (parentType === 'root') filter['PARENT_ID'] = 0;
  if (parentType === 'subtask') filter['!PARENT_ID'] = 0;
  if (parentIds?.length) filter['PARENT_ID'] = parentIds;
  if (groupId) filter['GROUP_ID'] = groupId;
  if (createdBy) filter['CREATED_BY'] = createdBy;
  if (responsibleId) filter['RESPONSIBLE_ID'] = responsibleId;
  if (accompliceId) filter['ACCOMPLICE'] = accompliceId;
  if (auditorId) filter['AUDITOR'] = auditorId;
  if (responsibleOrCreatedBy) {
    // Единственный OR, который Bitrix действительно выполняет как объединение: RESPONSIBLE_ID и
    // CREATED_BY — обычные колонки самой задачи. Форма ровно из документированного примера
    // CTasks::GetList — ::LOGIC=OR внутри подфильтра верхнего уровня, поля в пронумерованных
    // дочерних подфильтрах по одному. Замер на реальном портале: 1982 и 1622 по отдельности,
    // 2649 вместе — то есть объединение с пересечением, а не одно из двух.
    // Для ACCOMPLICE и AUDITOR та же форма молча вырождается в AND (678 и 9028 по отдельности,
    // 467 вместе) — они приходят JOIN'ом к таблице участников, и общий JOIN даёт пересечение.
    // Поэтому наблюдатель и соисполнитель по-прежнему требуют отдельных запросов.
    if (!filter['::LOGIC']) filter['::LOGIC'] = 'AND';
    filter['::SUBFILTER-1'] = {
      '::LOGIC': 'OR',
      '::SUBFILTER-1': {'RESPONSIBLE_ID': responsibleOrCreatedBy},
      '::SUBFILTER-2': {'CREATED_BY': responsibleOrCreatedBy},
    };
  }
  if (stageIds?.length) filter['STAGE_ID'] = stageIds;
  if (createdDateFrom) filter['>=CREATED_DATE'] = createdDateFrom;
  if (createdDateTo) filter['<=CREATED_DATE'] = createdDateTo;
  if (changedDateFrom) filter['>=CHANGED_DATE'] = changedDateFrom;
  if (changedDateTo) filter['<=CHANGED_DATE'] = changedDateTo;
  if (closedDateFrom) filter['>=CLOSED_DATE'] = closedDateFrom;
  if (closedDateTo) filter['<=CLOSED_DATE'] = closedDateTo;

  return filter;
}

/**
 * Превращает фильтр и набор полей в query-параметры одного вызова tasks.task.list.
 * @param {Record<string, any>} filter - Результат buildTasksFilter.
 * @param {Object} params
 * @param {number} params.start - Смещение страницы (страница всегда 50 записей).
 * @param {string[]} params.selectFields - Поля `select[]`.
 * @param {{field: string, direction: 'ASC'|'DESC'}|null} [params.order] - Сортировка на сервере.
 * @returns {URLSearchParams}
 */
function buildTaskListParams(filter, {start, selectFields, order = null}) {
  const params = new URLSearchParams({start});

  const appendFilter = (keyPath, value) => {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(`${keyPath}[]`, v));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => appendFilter(`${keyPath}[${k}]`, v));
    } else {
      params.set(keyPath, value);
    }
  };

  Object.entries(filter).forEach(([key, value]) => {
    appendFilter(`filter[${key}]`, value);
  });
  selectFields.forEach((field) => params.append('select[]', field));
  if (order?.field) params.set(`order[${order.field}]`, order.direction ?? 'ASC');

  return params;
}

export default class BitrixApi {
  /**
   * @param {string} sessionId - `BX_SESSION_ID` страницы Bitrix (см. content-scripts/main.js).
   * @param {string} [baseUrl] - Origin Bitrix. Нужен только страницам расширения (попап,
   * «Что нового»): у них свой origin (`chrome-extension://…`), поэтому относительный путь ушёл бы
   * не на сайт, а внутрь расширения. Домен нигде не хардкодится — его сохраняет контент-скрипт в
   * `chrome.storage.local.bitrixOrigin`, так что расширение остаётся универсальным для любого
   * Bitrix из manifest.matches. Контент-скриптам параметр не нужен: у них origin уже правильный.
   */
  constructor(sessionId, baseUrl = '') {
    this.sessionId = sessionId;
    // withCredentials — cookie сессии Bitrix при кросс-origin запросе со страницы расширения
    // (для контент-скрипта запрос свой же, cookie идут и без этого)
    this.http = baseUrl ? axios.create({baseURL: baseUrl, withCredentials: true}) : axios;
  }

  /**
   * Возвращает колонки (стадии) канбана без задач
   * @param {string} groupId
   * @return {Promise<axios.AxiosResponse<any>>}
   */
  getStages(groupId) {
    return this.http.postForm('/rest/task.stages.get.json', {
      sessid: this.sessionId,
      entityId: groupId,
    });
  }

  /**
   * Переносит задачу в стадию канбана. Нужен там, где стадию нельзя передать прямо в tasks.task.add:
   * стадии «Моего плана» — отдельная сущность (ENTITY_TYPE=U), и поле STAGE_ID задачи их не принимает,
   * а task.stages.movetask работает и с канбаном группы, и с личным планом.
   * В батч этот метод складывать нельзя — Bitrix отвечает ERROR_BATCH_METHOD_NOT_ALLOWED.
   * @param {string|number} taskId
   * @param {string|number} stageId
   * @return {Promise<axios.AxiosResponse<any>>}
   */
  moveTaskToStage(taskId, stageId) {
    return this.http.postForm('/rest/task.stages.movetask.json', {
      sessid: this.sessionId,
      id: taskId,
      stageId,
    });
  }

  static getUserNotifications(taskId) {
    const request = taskId
      ? axios.postForm('/alert/', {
        notifyFilterIn: {
          taskId,
          countOnPage: 999999,
        },
      })
      : axios.get('/alert/');

    return request.then(({data}) => {
      const parser = new DOMParser();
      const html = parser.parseFromString(data, 'text/html');

      if (taskId) {
        return [...html.querySelectorAll(`.message-item:has(a[href*="/tasks/task/view/${taskId}/"]) .message-delete-checkbox[data-id]:not([data-id=""])`)];
      }

      return [...html.querySelectorAll('.message-delete-checkbox[data-id]:not([data-id=""])')];
    });
  }

  /**
   * Batch-создание подзадач через tasks.task.add (до 50 задач на запрос).
   * STAGE_ID передаётся напрямую — отдельный moveStage не нужен.
   * Команды именуются `t{globalIndex}`, чтобы вызывающий код мог сопоставить ответы с исходным массивом.
   * @param {Array<{TITLE, DESCRIPTION, CREATED_BY, RESPONSIBLE_ID, AUDITORS, GROUP_ID, PARENT_ID, STAGE_ID}>} tasks
   * @return {Promise<axios.AxiosResponse<any>[]>}
   */
  addTasksBatch(tasks) {
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
      chunks.push(tasks.slice(i, i + CHUNK_SIZE));
    }

    return Promise.all(chunks.map((chunk, chunkIndex) => {
      const cmd = {};
      chunk.forEach((task, i) => {
        const params = new URLSearchParams({
          'fields[TITLE]': task.TITLE,
          'fields[CREATED_BY]': task.CREATED_BY,
          'fields[RESPONSIBLE_ID]': task.RESPONSIBLE_ID,
          'fields[GROUP_ID]': task.GROUP_ID,
          'fields[PARENT_ID]': task.PARENT_ID,
        });
        if (task.DESCRIPTION) {
          params.set('fields[DESCRIPTION]', task.DESCRIPTION);
        }
        if (task.STAGE_ID) {
          params.set('fields[STAGE_ID]', task.STAGE_ID);
        }
        (task.AUDITORS ?? []).forEach((id) => params.append('fields[AUDITORS][]', id));

        cmd[`t${chunkIndex * CHUNK_SIZE + i}`] = `tasks.task.add?${params.toString()}`;
      });

      return this.http.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      });
    }));
  }

  /**
   * Группы и проекты, в которых состоит текущий пользователь (sonet_group.user.groups).
   * Единственный дешёвый способ узнать состав групп на личном плане: собирать их из самих задач
   * пришлось бы, выкачав весь «Мой план» целиком.
   * @return {Promise<Array<{id: string, name: string}>>} Группы, отсортированные по названию.
   */
  getUserGroups() {
    return this.http.postForm('/rest/sonet_group.user.groups.json', {sessid: this.sessionId})
      .then(({data}) => (data?.result ?? [])
        .map((group) => ({id: String(group.GROUP_ID), name: group.GROUP_NAME ?? `Группа #${group.GROUP_ID}`}))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')));
  }

  /**
   * Возвращает участников группы (сырые объекты user.get).
   * @param {string} groupId
   * @return {Promise<any[]>}
   */
  getGroupUsers(groupId) {
    return this.http.postForm('/rest/sonet_group.user.get.json', {
      sessid: this.sessionId,
      ID: groupId,
    }).then(({data}) => {
      const memberIds = (data?.result ?? []).map((m) => m.USER_ID);
      if (!memberIds.length) return [];

      const params = new URLSearchParams({sessid: this.sessionId});
      memberIds.forEach((id) => params.append('filter[ID][]', id));

      return this.http.post('/rest/user.get.json', params)
        .then(({data: usersData}) => usersData?.result ?? []);
    });
  }

  /**
   * Batch-запросы tasks.task.list по колонкам, исключая завершённые задачи.
   * @param {Array<{key: string, stageId: string, start: number}>} stageRequests
   * @param {string} groupId
   * @return {Promise<axios.AxiosResponse<any>[]>}
   */
  getTasksBatch(stageRequests, groupId) {
    if (!stageRequests.length) return Promise.resolve([]);

    const BATCH_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < stageRequests.length; i += BATCH_SIZE) {
      chunks.push(stageRequests.slice(i, i + BATCH_SIZE));
    }

    return Promise.all(chunks.map((chunk) => {
      const cmd = {};
      chunk.forEach(({key, stageId, start}) => {
        const params = new URLSearchParams({
          'filter[GROUP_ID]': groupId,
          'filter[STAGE_ID]': stageId,
          'filter[!STATUS]': 5,
          start,
        });
        // Только нужные поля — исключаем description, auditorsData, accomplicesData и т.д.
        ['ID', 'TITLE', 'STAGE_ID', 'RESPONSIBLE_ID', 'ACTIVITY_DATE', 'TASK_CONTROL', 'PARENT_ID'].forEach((field) => {
          params.append('select[]', field);
        });
        cmd[key] = `tasks.task.list?${params.toString()}`;
      });

      return this.http.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      });
    }));
  }

  /**
   * Все незавершённые задачи указанных колонок канбана, со всеми страницами.
   * Первым batch-запросом берёт по первой странице каждой колонки, из ответа узнаёт общее число
   * задач (`result_total`) и вторым запросом добирает недостающие страницы — виджетам нужен готовый
   * плоский список, а не постраничная выдача.
   * @param {Array<string|number>} stageIds - ID колонок канбана.
   * @param {string} groupId
   * @return {Promise<any[]>} Задачи всех колонок одним массивом.
   */
  async getAllTasksByStages(stageIds, groupId) {
    if (!stageIds.length) return [];

    const PAGE_SIZE = 50;
    const firstPageRequests = stageIds.map((stageId, index) => ({key: `s${index}`, stageId, start: 0}));
    const firstResponses = await this.getTasksBatch(firstPageRequests, groupId);

    const tasks = [];
    const remainingRequests = [];

    firstResponses.forEach((response) => {
      const {result, result_total: resultTotal} = response.data?.result ?? {};
      Object.entries(result ?? {}).forEach(([key, stageResult]) => {
        tasks.push(...(stageResult.tasks ?? []));

        const total = resultTotal?.[key] ?? 0;
        if (total <= PAGE_SIZE) return;

        const stageId = stageIds[Number(key.slice(1))];
        const pageCount = Math.ceil(total / PAGE_SIZE);
        for (let page = 1; page < pageCount; page++) {
          remainingRequests.push({key: `${key}p${page}`, stageId, start: page * PAGE_SIZE});
        }
      });
    });

    if (remainingRequests.length) {
      const remainingResponses = await this.getTasksBatch(remainingRequests, groupId);
      remainingResponses.forEach((response) => {
        Object.values(response.data?.result?.result ?? {}).forEach((stageResult) => {
          tasks.push(...(stageResult.tasks ?? []));
        });
      });
    }

    return tasks;
  }

  completeTasksBatch(taskIds) {
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
      chunks.push(taskIds.slice(i, i + CHUNK_SIZE));
    }

    return Promise.all(chunks.map((chunk) => {
      const cmd = {};
      chunk.forEach((id, i) => {
        cmd[`t${i}`] = `tasks.task.complete?taskId=${id}`;
      });

      return this.http.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      });
    }));
  }

  /**
   * Batch-возврат завершённых задач в работу — tasks.task.renew. Отменяет completeTasksBatch:
   * переводит задачи из статуса «Завершена» в статус «Ждёт выполнения» — под тем же STAGE_ID,
   * поэтому они снова попадают под фильтр getTasksBatch (`!STATUS: 5`) и возвращаются в прежнюю
   * колонку канбана.
   * @param {Array<string|number>} taskIds
   * @return {Promise<axios.AxiosResponse<any>[]>}
   */
  renewTasksBatch(taskIds) {
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
      chunks.push(taskIds.slice(i, i + CHUNK_SIZE));
    }

    return Promise.all(chunks.map((chunk) => {
      const cmd = {};
      chunk.forEach((id, i) => {
        cmd[`t${i}`] = `tasks.task.renew?taskId=${id}`;
      });

      return this.http.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      });
    }));
  }

  /**
   * Batch-подтверждение выполнения задач с включённым контролем («Принять работу») — tasks.task.approve.
   * Переводит задачу из статуса «Ждёт контроля» (4) в статус «Завершена» (5). Вызывать только после completeTasksBatch —
   * approve работает лишь для задач, уже переведённых исполнителем в статус ожидания контроля.
   * Доступно только постановщику или наблюдателю задачи — для остальных задача попадёт в failedIds, не прерывая batch (halt: false).
   * @param {Array<string|number>} taskIds
   * @return {Promise<{approvedIds: Array<string|number>, failedIds: Array<string|number>}>}
   */
  approveTasksBatch(taskIds) {
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
      chunks.push(taskIds.slice(i, i + CHUNK_SIZE));
    }

    return Promise.all(chunks.map((chunk) => {
      const cmd = {};
      chunk.forEach((id, i) => {
        cmd[`t${i}`] = `tasks.task.approve?taskId=${id}`;
      });

      return this.http.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      }).then(({data}) => {
        const approvedIds = [];
        const failedIds = [];
        chunk.forEach((id, i) => {
          if (data?.result?.result?.[`t${i}`]) {
            approvedIds.push(id);
          } else {
            failedIds.push(id);
          }
        });
        return {approvedIds, failedIds};
      });
    })).then((chunkResults) => ({
      approvedIds: chunkResults.flatMap((chunkResult) => chunkResult.approvedIds),
      failedIds: chunkResults.flatMap((chunkResult) => chunkResult.failedIds),
    }));
  }

  getComments(taskId) {
    return axios
      .postForm('/rest/task.commentitem.getlist.json', {
        sessid: this.sessionId,
        TASKID: taskId,
        ORDER: { POST_DATE: 'asc' },
      })
      .then((response) => response.data?.result ?? []);
  }

  /**
   * Batch-запрос task.commentitem.getlist для нескольких задач (до 50 за раз) — избегает
   * N отдельных запросов при массовой выгрузке комментариев сразу по многим задачам.
   * @param {Array<string|number>} taskIds
   * @return {Promise<Record<string, object[]>>} Карта taskId → массив комментариев
   */
  getCommentsBatch(taskIds) {
    if (!taskIds.length) return Promise.resolve({});
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
      chunks.push(taskIds.slice(i, i + CHUNK_SIZE));
    }
    return Promise.all(chunks.map((chunk) => {
      const cmd = {};
      chunk.forEach((taskId) => {
        cmd[`c${taskId}`] = `task.commentitem.getlist?TASKID=${taskId}&ORDER[POST_DATE]=asc`;
      });
      return this.http.postForm('/rest/batch.json', { sessid: this.sessionId, halt: false, cmd });
    })).then((responses) => {
      const result = {};
      responses.forEach((response) => {
        Object.entries(response.data?.result?.result ?? {}).forEach(([key, comments]) => {
          result[key.slice(1)] = comments ?? [];
        });
      });
      return result;
    });
  }

  getAttachedObjectsBatch(attachmentIds) {
    if (!attachmentIds.length) return Promise.resolve([]);
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < attachmentIds.length; i += CHUNK_SIZE) {
      chunks.push(attachmentIds.slice(i, i + CHUNK_SIZE));
    }
    return Promise.all(chunks.map((chunk) => {
      const cmd = {};
      chunk.forEach((id, i) => {
        cmd[`a${i}`] = `disk.attachedObject.get?id=${id}`;
      });
      return this.http.postForm('/rest/batch.json', { sessid: this.sessionId, halt: false, cmd });
    })).then((responses) => responses.flatMap(
      ({data}) => Object.values(data?.result?.result ?? {}).filter(Boolean),
    ));
  }

  /**
   * Возвращает данные файлов Диска (имя, ссылка на скачивание) по их ID — в отличие от
   * getAttachedObjectsBatch, работает по ID самого файла Диска, а не по ID связи-вложения.
   * Нужен для картинок, вставленных прямо в текст описания/комментария (не через список вложений).
   * @param {string[]} fileIds
   * @return {Promise<any[]>}
   */
  getDiskFilesBatch(fileIds) {
    if (!fileIds.length) return Promise.resolve([]);
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < fileIds.length; i += CHUNK_SIZE) {
      chunks.push(fileIds.slice(i, i + CHUNK_SIZE));
    }
    return Promise.all(chunks.map((chunk) => {
      const cmd = {};
      chunk.forEach((id, i) => {
        cmd[`f${i}`] = `disk.file.get?id=${id}`;
      });
      return this.http.postForm('/rest/batch.json', { sessid: this.sessionId, halt: false, cmd });
    })).then((responses) => responses.flatMap(
      ({data}) => Object.values(data?.result?.result ?? {}).filter(Boolean),
    ));
  }

  getTask(taskId, select = []) {
    const params = new URLSearchParams({sessid: this.sessionId, taskId});
    select.forEach((field) => params.append('select[]', field));
    return this.http.post('/rest/tasks.task.get.json', params);
  }

  removeNotifications(ids) {
    return this.http.postForm('/rest/im.notify.delete.json', {
      sessid: this.sessionId,
      id: ids,
    });
  }

  /**
   * Отмечает одно уведомление прочитанным.
   * ONLY_CURRENT обязателен: без него Bitrix отмечает прочитанными все уведомления с ID не меньше
   * указанного — то есть заодно и личные, пришедшие позже.
   * @param {string|number} notificationId - ID уведомления.
   * @return {Promise<axios.AxiosResponse<any>>}
   */
  markNotificationRead(notificationId) {
    return this.http.postForm('/rest/im.notify.read.json', {
      sessid: this.sessionId,
      ID: notificationId,
      ACTION: 'Y',
      ONLY_CURRENT: 'Y',
    });
  }

  /**
   * Обновляет поля задачи (tasks.task.update).
   * @param {string|number} taskId
   * @param {Record<string, any>} fields — объект с полями задачи, например { TITLE: 'Новое название' }
   */
  // Только скалярные поля — для массивов нужен params.append(`fields[KEY][]`, v) как в addTask
  updateTask(taskId, fields) {
    const params = new URLSearchParams({
      sessid: this.sessionId,
      taskId,
    });
    Object.entries(fields).forEach(([key, value]) => {
      params.set(`fields[${key}]`, value);
    });
    return this.http.post('/rest/tasks.task.update.json', params);
  }

  favoriteTask(taskId) {
    return this.http.postForm('/rest/tasks.task.favorite.add.json', {
      sessid: this.sessionId,
      taskId,
    });
  }

  unfavoriteTask(taskId) {
    return this.http.postForm('/rest/tasks.task.favorite.remove.json', {
      sessid: this.sessionId,
      taskId,
    });
  }

  /**
   * Поиск задач по фильтрам с постраничной загрузкой через batch.
   * @param {Object} params
   * @param {boolean} params.favorite - только избранные задачи (Bitrix native)
   * @param {string|null} params.title - поиск по названию (LIKE)
   * @param {boolean} params.smartTitleSearch - разбивать title по пробелам и искать каждое слово через AND
   * @param {'active'|'closed'|null} params.status - 'active' = не завершённые, 'closed' = завершённые, null = все
   * @param {'all'|'root'|'subtask'} params.parentType - 'root' = только корневые задачи, 'subtask' = только подзадачи, 'all' = все
   * @param {Array<string|number>|null} params.parentIds - прямые дети конкретных задач (для обхода дерева подзадач по уровням); не сочетается с parentType
   * @param {string|null} params.groupId - ID группы (null = глобальный поиск)
   * @param {string|number|null} params.createdBy - ID постановщика
   * @param {string|number|null} params.responsibleId - ID исполнителя
   * @param {Array<string|number>|null} params.stageIds - ID колонок канбана (мультиселект)
   * @param {string|null} params.createdDateFrom - дата создания от ('YYYY-MM-DD HH:mm:ss')
   * @param {string|null} params.createdDateTo - дата создания до
   * @param {string|null} params.changedDateFrom - дата изменения от
   * @param {string|null} params.changedDateTo - дата изменения до
   * @param {string|null} params.closedDateFrom - дата закрытия от ('YYYY-MM-DD HH:mm:ss')
   * @param {string|null} params.closedDateTo - дата закрытия до
   * @param {{field: string, direction: 'ASC'|'DESC'}|null} params.order - сортировка результата на сервере (например {field: 'CREATED_DATE', direction: 'DESC'}); по умолчанию не задаётся
   * @param {string[]} params.extraSelectFields - дополнительные поля `select[]` сверх базового набора (например ['DESCRIPTION']) — не добавляются в общий набор, чтобы не утяжелять остальных вызывающих
   * @param {string[]|null} params.selectFields - полная замена базового набора `select[]`: аналитике нужны свои поля (COMMENTS_COUNT, ACTIVITY_DATE) и не нужны базовые (FAVORITE, CHANGED_DATE), а на тысячах задач лишние поля — это лишние мегабайты
   * @param {((progress: {loaded: number, total: number}) => void)|null} params.onProgress - вызывается после первой страницы и после каждого батча: выгрузка больших диапазонов идёт десятки секунд, и вызывающему нужно чем-то показать процент
   * @return {Promise<any[]>}
   */
  async searchTasks({
                      order = null,
                      extraSelectFields = [],
                      selectFields = null,
                      onProgress = null,
                      limit = null,
                      ...filterParams
                    }) {
    const PAGE_SIZE = 50;

    const filter = buildTasksFilter(filterParams);
    const fields = [...(selectFields ?? DEFAULT_TASK_SELECT_FIELDS), ...extraSelectFields];
    const buildParams = (start) => buildTaskListParams(filter, {start, selectFields: fields, order});

    const firstParams = buildParams(0);
    firstParams.set('sessid', this.sessionId);
    const {data: firstData} = await this.requestWithRateLimitRetry(
      () => this.http.post('/rest/tasks.task.list.json', firstParams),
    );
    const tasks = firstData?.result?.tasks ?? [];
    const total = firstData?.total ?? 0;
    const effectiveTotal = limit ? Math.min(total, limit) : total;
    const reportProgress = (extraLoaded = 0) => onProgress?.({
      loaded: Math.min(tasks.length + extraLoaded, effectiveTotal),
      total: effectiveTotal,
    });
    reportProgress();

    if (effectiveTotal > PAGE_SIZE) {
      const remainingStarts = [];
      for (let start = PAGE_SIZE; start < effectiveTotal; start += PAGE_SIZE) {
        remainingStarts.push(start);
      }

      const {pageTasks, failedStarts} = await this.fetchTaskPages(remainingStarts, buildParams, reportProgress);
      tasks.push(...pageTasks);

      if (failedStarts.length) {
        // Часть страниц отвалилась внутри батча (обычно лимит интенсивности) — добираем их отдельным
        // проходом: без этого в выборке молча не хватило бы задач, а графики выглядели бы правдоподобно
        await delay(RATE_LIMIT_RETRY_DELAYS[0]);
        const retry = await this.fetchTaskPages(failedStarts, buildParams, reportProgress);
        tasks.push(...retry.pageTasks);
        if (retry.failedStarts.length) {
          throw new Error(`Bitrix ограничил число запросов: не удалось загрузить ${retry.failedStarts.length * PAGE_SIZE} задач. Сузьте период и повторите через несколько минут.`);
        }
      }
    }

    return limit ? tasks.slice(0, limit) : tasks;
  }

  /**
   * Возвращает уникальные задачи, где пользователь фигурирует в любой из 4 ролей — ответственный,
   * соисполнитель, наблюдатель или постановщик. Именно так Bitrix формирует личный канбан
   * «Мой план» — он не ограничивается ответственностью (проверено эмпирически на реальном
   * канбане: объединение всех 4 ролей дало 100% совпадение с видимыми карточками, при этом
   * RESPONSIBLE_ID — не самая крупная роль).
   * Одним запросом все 4 роли не забрать: ответственный и постановщик объединяются через OR
   * (см. responsibleOrCreatedBy в buildTasksFilter), а соисполнитель и наблюдатель — нет, для них
   * тот же OR вырождается в пересечение. Отсюда три запроса через уже существующий searchTasks()
   * (со всей его пагинацией и повтором при рейт-лимите) и объединение здесь с дедупликацией по id.
   * @param {string|number} userId
   * @param {Object} [params] - остальные параметры searchTasks (status, selectFields, limit и т.д.), общие для всех запросов
   * @returns {Promise<any[]>}
   */
  async searchMyTasks(userId, {order, limit, onProgress, ...params} = {}) {
    const ROLE_FILTERS = [
      {responsibleOrCreatedBy: userId},
      {accompliceId: userId},
      {auditorId: userId},
    ];

    // Прогресс общий на все запросы: каждый ролевой запрос считает свои loaded/total, и если
    // отдавать их наружу как есть, полоса дёргалась бы между ролями. Складываем последние
    // известные значения каждой роли
    const progressByRole = ROLE_FILTERS.map(() => ({loaded: 0, total: 0}));
    const trackRoleProgress = (roleIndex) => (progress) => {
      progressByRole[roleIndex] = progress;
      onProgress({
        loaded: progressByRole.reduce((sum, item) => sum + item.loaded, 0),
        total: progressByRole.reduce((sum, item) => sum + item.total, 0),
      });
    };

    const results = await Promise.all(
      // limit передаётся в каждый запрос, чтобы не выкачивать лишнее (например, у наблюдателя
      // задач может быть на порядок больше остальных ролей) — после объединения список пересортировывается
      // и обрезается до limit ещё раз, иначе после дедупликации порядок был бы «сначала все ответственные,
      // потом все соисполнители» вместо реальной сортировки по order
      ROLE_FILTERS.map((roleFilter, roleIndex) => this.searchTasks({
        ...params,
        ...roleFilter,
        order,
        limit,
        onProgress: onProgress ? trackRoleProgress(roleIndex) : null,
      })),
    );

    const taskById = new Map();
    results.flat().forEach((task) => taskById.set(task.id, task));
    const tasks = [...taskById.values()];

    if (order?.field) {
      // Bitrix ожидает поле фильтра/сортировки в верхнем регистре с подчёркиванием (CREATED_DATE),
      // а сама задача в ответе tasks.task.list возвращается с тем же полем в camelCase (createdDate)
      const key = order.field.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const direction = order.direction === 'ASC' ? 1 : -1;
      tasks.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * direction);
    }

    return limit ? tasks.slice(0, limit) : tasks;
  }

  /**
   * Повторяет запрос, когда Bitrix отвечает ограничением интенсивности (503 QUERY_LIMIT_EXCEEDED)
   * или ресурсоёмкости (429 OPERATION_TIME_LIMIT), с растущими паузами. Остальные ошибки пробрасывает.
   * Когда повторы кончились, тоже бросает: ограничение приходит и со статусом 200, и молча вернуть
   * такой ответ значило бы показать пустую выборку вместо ошибки.
   * @param {() => Promise<axios.AxiosResponse<any>>} sendRequest
   * @return {Promise<axios.AxiosResponse<any>>}
   */
  async requestWithRateLimitRetry(sendRequest) {
    for (let attempt = 0; ; attempt++) {
      const canRetry = attempt < RATE_LIMIT_RETRY_DELAYS.length;
      let response;

      try {
        response = await sendRequest();
      } catch (e) {
        if (!isRateLimitResponse(e.response?.data, e.response?.status)) throw e;
        if (!canRetry) throw new Error(RATE_LIMIT_ERROR_MESSAGE, {cause: e});
        await delay(RATE_LIMIT_RETRY_DELAYS[attempt]);
        continue;
      }

      if (!isRateLimitResponse(response.data, response.status)) return response;
      if (!canRetry) throw new Error(RATE_LIMIT_ERROR_MESSAGE);
      await delay(RATE_LIMIT_RETRY_DELAYS[attempt]);
    }
  }

  /**
   * Выгружает страницы tasks.task.list батчами по 50 команд, **последовательно**: на длинном диапазоне
   * это сотни вызовов метода, и одновременная отправка всех батчей упирается в лимиты Bitrix.
   * @param {number[]} starts - Смещения страниц.
   * @param {(start: number) => URLSearchParams} buildParams - Параметры одного вызова по смещению.
   * @param {((loadedInThisCall: number) => void)|null} [onChunkLoaded] - Вызывается после каждого батча с числом уже выгруженных здесь задач (для прогресса).
   * @return {Promise<{pageTasks: any[], failedStarts: number[]}>} Задачи и смещения страниц, ответ по которым не пришёл.
   */
  async fetchTaskPages(starts, buildParams, onChunkLoaded = null) {
    const BATCH_SIZE = 50;
    const pageTasks = [];
    const failedStarts = [];

    for (let i = 0; i < starts.length; i += BATCH_SIZE) {
      const chunk = starts.slice(i, i + BATCH_SIZE);
      const cmd = {};
      chunk.forEach((start) => {
        cmd[`p${start}`] = `tasks.task.list?${buildParams(start).toString()}`;
      });

      const response = await this.requestWithRateLimitRetry(() => this.http.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      }));

      const {result, result_error: resultError} = response.data?.result ?? {};
      Object.values(result ?? {}).forEach((pageResult) => {
        pageTasks.push(...(pageResult?.tasks ?? []));
      });
      Object.keys(resultError ?? {}).forEach((key) => {
        failedStarts.push(Number(key.slice(1)));
      });

      onChunkLoaded?.(pageTasks.length);
    }

    return {pageTasks, failedStarts};
  }

  /**
   * Число задач по каждому набору фильтров, без выгрузки самих задач. Нужно для предварительной оценки
   * объёма («будет загружено ~N задач») перед тяжёлой выгрузкой; всё уходит одним батчем, потому что
   * прикидок обычно несколько, а по отдельности они лишь задерживают старт загрузки.
   * @param {Object[]} paramsList - Наборы параметров фильтрации (те же, что у searchTasks).
   * @return {Promise<number[]>} Количества в том же порядке, что наборы.
   */
  async countTasksBatch(paramsList) {
    const BATCH_SIZE = 50;
    const counts = [];

    for (let i = 0; i < paramsList.length; i += BATCH_SIZE) {
      const chunk = paramsList.slice(i, i + BATCH_SIZE);
      const cmd = {};
      chunk.forEach((params, index) => {
        const listParams = buildTaskListParams(buildTasksFilter(params), {start: 0, selectFields: ['ID']});
        cmd[`c${index}`] = `tasks.task.list?${listParams.toString()}`;
      });

      const response = await this.requestWithRateLimitRetry(() => this.http.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      }));

      // Общее количество под фильтром батч отдаёт отдельным полем result_total, по имени команды
      const totals = response.data?.result?.result_total ?? {};
      chunk.forEach((_, index) => counts.push(Number(totals[`c${index}`] ?? 0)));
    }

    return counts;
  }

  addTask(fields) {
    const params = new URLSearchParams({sessid: this.sessionId});
    Object.entries(fields).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(`fields[${key}][]`, v));
      } else if (value != null) {
        params.set(`fields[${key}]`, value);
      }
    });
    return this.http.post('/rest/tasks.task.add.json', params);
  }

  getCurrentUser() {
    return this.http.postForm('/rest/user.current.json', {
      sessid: this.sessionId,
    }).then(({data}) => data?.result ?? null);
  }

  /**
   * Добавляет комментарий к задаче.
   * @param {string|number} taskId
   * @param {string} text
   * @return {Promise<axios.AxiosResponse<any>>}
   */
  addComment(taskId, text) {
    const params = new URLSearchParams({
      sessid: this.sessionId,
      TASKID: taskId,
      'FIELDS[POST_MESSAGE]': text,
    });
    return this.http.post('/rest/task.commentitem.add.json', params);
  }

  searchTasksByFulltext(query) {
    return this.http.postForm(
      '/bitrix/services/main/ajax.php?action=tasks.task.search',
      {searchQuery: query},
      {
        headers: {
          'x-bitrix-csrf-token': this.sessionId,
        },
      },
    );
  }

  /**
   * Отмечает задачу просмотренной — тем же внутренним контроллером, который дёргает сама карточка
   * задачи при открытии. Снимает пометку о непрочитанных комментариях. Прочитать один конкретный
   * комментарий нельзя: Bitrix фиксирует просмотр по задаче целиком, а официального REST-метода
   * для этого нет вовсе (комментарии стали чатом только с версии модуля tasks 25.700).
   * @param {string|number} taskId
   * @return {Promise<axios.AxiosResponse<any>>}
   */
  markTaskViewed(taskId) {
    return this.http.postForm(
      '/bitrix/services/main/ajax.php?action=tasks.task.view.update',
      {taskId},
      {
        headers: {
          'x-bitrix-csrf-token': this.sessionId,
        },
      },
    );
  }

  /**
   * Задаёт список связанных задач — блок «Связанные задачи» в карточке.
   * REST-метода для него нет (`SE_RELATEDTASK` в списке полей задачи отсутствует, а
   * `task.dependence.add` создаёт другую сущность — связи диаграммы Ганта), поэтому пишем
   * операцией task.update внутреннего диспетчера модуля tasks — тем же запросом, который шлёт
   * форма редактирования задачи. Проверено экспериментом: остальные поля задачи не затрагиваются.
   *
   * Две особенности контракта: список перезаписывается целиком (чтобы добавить связь к
   * существующим, надо передать и их), а связь односторонняя — чтобы задачи видели друг друга,
   * метод вызывается для каждой из них.
   *
   * Ответ — HTML формы, и разобрать его целиком незачем, но отличить явный отказ можно: нет доступа
   * или истекла сессия — Bitrix уводит на другую страницу, и это видно по итоговому адресу запроса,
   * без привязки к вёрстке. Мягкий отказ, при котором форма перерисовалась с сообщением об ошибке,
   * так не поймать: REST-метода для чтения связей нет (`SE_RELATEDTASK` в полях задачи отсутствует),
   * так что проверить результат обратным запросом нечем.
   * @param {string|number} taskId
   * @param {Array<string|number>} relatedTaskIds Полный новый список связей
   * @param {string|number} userId ID текущего пользователя: Bitrix проверяет доступ по сегменту URL
   * @return {Promise<axios.AxiosResponse<any>>}
   */
  async setRelatedTasks(taskId, relatedTaskIds, userId) {
    const params = new URLSearchParams({
      sessid: this.sessionId,
      'ACTION[0][OPERATION]': 'task.update',
      'ACTION[0][PARAMETERS][CODE]': 'task_action',
      'ACTION[0][ARGUMENTS][id]': taskId,
      'ACTION[0][ARGUMENTS][data][SE_RELATEDTASK][]': '',
    });
    relatedTaskIds.forEach((id) => params.set(`ACTION[0][ARGUMENTS][data][SE_RELATEDTASK][${id}][ID]`, id));

    const editPath = `/company/personal/user/${userId}/tasks/task/edit/${taskId}/`;
    const response = await this.http.post(editPath, params);

    // responseURL может быть недоступен (не XHR-адаптер) — тогда проверку пропускаем, а не считаем
    // отказом: ложное «связать не удалось» на успешном запросе хуже, чем неполная проверка
    const finalUrl = response.request?.responseURL ?? '';
    if (typeof response.data !== 'string' || !response.data
      || (finalUrl && !finalUrl.includes('/tasks/task/edit/'))) {
      throw new Error('Bitrix не принял запрос на связывание задач — нет доступа или истекла сессия');
    }

    return response;
  }

  /**
   * Отправляет одну порцию команд batch.json (до BATCH_COMMAND_LIMIT штук).
   * @param {Record<string, string>} cmd - Карта «ключ команды → метод?параметры».
   * @return {Promise<axios.AxiosResponse<any>>}
   */
  postBatchCommands(cmd) {
    return this.requestWithRateLimitRetry(
      () => this.http.postForm('/rest/batch.json', {sessid: this.sessionId, halt: false, cmd}),
    );
  }

  /**
   * Batch-запрос tasks.task.get для нескольких задач.
   * Поля ответа в camelCase: id, responsibleId, createdBy, groupId, stageId.
   * Задачи, по которым ответ не пришёл, в карту не попадают — вызывающий код не может отличить
   * удалённую задачу от сбоя, поэтому отсутствие задачи нельзя считать окончательным ответом.
   * @param {string[]} taskIds
   * @param {string[]} [select] - Поля задачи, только нужные.
   * @return {Promise<Record<string, object>>} Карта taskId → task
   */
  async getTasksByIdsBatch(taskIds, select = ['ID', 'TITLE', 'RESPONSIBLE_ID', 'CREATED_BY', 'GROUP_ID', 'STAGE_ID', 'CREATED_DATE', 'CHANGED_DATE']) {
    if (!taskIds.length) return {};

    const commands = {};
    taskIds.forEach((taskId, index) => {
      const params = new URLSearchParams({taskId});
      select.forEach((field) => params.append('select[]', field));
      commands[`t${index}`] = `tasks.task.get?${params.toString()}`;
    });

    const tasksById = {};
    let pending = commands;

    for (let attempt = 0; ; attempt++) {
      const chunks = chunkBatchCommands(pending);
      const responses = [];

      if (attempt === 0) {
        // В норме лимит не срабатывает, поэтому первый проход идёт порциями параллельно — так заметно
        // быстрее на сотне карточек. Повторы, наоборот, последовательно: одновременные порции лимит
        // и провоцируют, и повторять их тем же способом бессмысленно
        responses.push(...await Promise.all(chunks.map((chunk) => this.postBatchCommands(chunk))));
      } else {
        for (const chunk of chunks) {
          responses.push(await this.postBatchCommands(chunk));
        }
      }

      const limited = {};
      responses.forEach((response, chunkIndex) => {
        Object.values(response.data?.result?.result ?? {}).forEach((commandResult) => {
          const task = commandResult?.task;
          if (task?.id) tasksById[task.id] = task;
        });

        // Ограничение приходит и по отдельной команде батча — со статусом 200 и без общей ошибки,
        // так что requestWithRateLimitRetry его не видит
        Object.entries(response.data?.result?.result_error ?? {}).forEach(([key, commandError]) => {
          if (isRateLimitResponse(commandError) && chunks[chunkIndex][key]) {
            limited[key] = chunks[chunkIndex][key];
          }
        });
      });

      if (!Object.keys(limited).length) return tasksById;

      // Повторяем только упавшие команды: пришедшее из тех же порций уже лежит в карте и заново
      // не запрашивается. Когда повторы кончились — бросаем: молча вернуть неполную карту нельзя,
      // вызывающий код принял бы сбой за отсутствие задачи
      if (attempt >= PER_COMMAND_RETRY_DELAYS.length) throw new Error(RATE_LIMIT_ERROR_MESSAGE);

      await delay(PER_COMMAND_RETRY_DELAYS[attempt]);
      pending = limited;
    }
  }

  /**
   * Выполняет произвольный набор команд batch.json, разбивая его на допустимые порции, и отдаёт
   * объединённый `result.result`. Ключи команд обязаны быть уникальными — по ним и склеивается
   * результат, а вызывающий код нередко достаёт из ключа идентификатор (см. getGroupsByIdsBatch).
   * @param {Record<string, string>} commands - Карта «ключ команды → метод?параметры».
   * @return {Promise<Record<string, any>>} Ответы всех команд одной картой.
   */
  runBatchCommands(commands) {
    return Promise.all(
      chunkBatchCommands(commands).map((cmd) => this.postBatchCommands(cmd)),
    ).then((responses) => Object.assign({}, ...responses.map((response) => response.data?.result?.result ?? {})));
  }

  /**
   * Batch-запрос task.stages.get для нескольких групп. Групп может быть много — на личном плане
   * стадии собираются по всем группам, из которых в него попали задачи, — поэтому идёт порциями.
   * @param {string[]} groupIds
   * @return {Promise<Record<string, object>>} Карта stageId → stage (UPPER_CASE поля)
   */
  getStagesBatch(groupIds) {
    if (!groupIds.length) return Promise.resolve({});
    const cmd = {};
    groupIds.forEach((id) => {
      cmd[`s${id}`] = `task.stages.get?entityId=${id}`;
    });
    return this.runBatchCommands(cmd).then((results) => {
      const stages = {};
      Object.values(results).forEach((val) => {
        Object.values(val ?? {}).forEach((stage) => {
          if (stage?.ID) stages[stage.ID] = stage;
        });
      });
      return stages;
    });
  }

  /**
   * Batch-запрос sonet_group.get для нескольких групп.
   * @param {string[]} groupIds
   * @return {Promise<Record<string, object>>} Карта groupId → group (UPPER_CASE поля: ID, NAME)
   */
  getGroupsByIdsBatch(groupIds) {
    if (!groupIds.length) return Promise.resolve({});
    const cmd = {};
    groupIds.forEach((id) => {
      cmd[`g${id}`] = `sonet_group.get?FILTER[ID]=${id}&select[]=ID&select[]=NAME`;
    });
    return this.runBatchCommands(cmd).then((results) => {
      const groups = {};
      Object.entries(results).forEach(([key, val]) => {
        const id = key.slice(1);
        const group = Array.isArray(val) ? val[0] : val;
        if (group?.ID) groups[id] = group;
      });
      return groups;
    });
  }

  /**
   * Резервный способ достать название группы, когда sonet_group.get недоступен (нет доступа к
   * группе): на странице просмотра задачи название группы отображается всегда, независимо от
   * доступа к самой группе — доступ проверяется на уровне задачи, а не группы.
   * @param {string} userId
   * @param {string} taskId
   * @return {Promise<string|null>}
   */
  getGroupNameFromTaskPage(userId, taskId) {
    return this.http.get(`/company/personal/user/${userId}/tasks/task/view/${taskId}/`).then(({data}) => {
      const parser = new DOMParser();
      const html = parser.parseFromString(data, 'text/html');
      return html.querySelector(`#task-${taskId}-group-value`)?.textContent?.trim() || null;
    });
  }

  /**
   * Batch-запрос im.user.get для нескольких пользователей.
   * Возвращает camelCase поля: id, name, first_name, last_name, avatar.
   * @param {string[]} userIds
   * @return {Promise<Record<string, object>>} Карта userId → user
   */
  getImUsersBatch(userIds) {
    if (!userIds.length) return Promise.resolve({});
    const cmd = {};
    userIds.forEach((id) => {
      cmd[`u${id}`] = `im.user.get?ID=${id}`;
    });
    return this.runBatchCommands(cmd).then((results) => {
      const users = {};
      Object.values(results).forEach((val) => {
        if (val?.id) users[String(val.id)] = val;
      });
      return users;
    });
  }
}
