import axios from 'axios';

export default class BitrixApi {
  constructor(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Возвращает колонки (стадии) канбана без задач
   * @param {string} groupId
   * @return {Promise<axios.AxiosResponse<any>>}
   */
  getStages(groupId) {
    return axios.postForm('/rest/task.stages.get.json', {
      sessid: this.sessionId,
      entityId: groupId,
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

      return axios.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      });
    }));
  }

  /**
   * Возвращает участников группы (сырые объекты user.get).
   * @param {string} groupId
   * @return {Promise<any[]>}
   */
  getGroupUsers(groupId) {
    return axios.postForm('/rest/sonet_group.user.get.json', {
      sessid: this.sessionId,
      ID: groupId,
    }).then(({ data }) => {
      const memberIds = (data?.result ?? []).map((m) => m.USER_ID);
      if (!memberIds.length) return [];

      const params = new URLSearchParams({ sessid: this.sessionId });
      memberIds.forEach((id) => params.append('filter[ID][]', id));

      return axios.post('/rest/user.get.json', params)
        .then(({ data: usersData }) => usersData?.result ?? []);
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
      chunk.forEach(({ key, stageId, start }) => {
        const params = new URLSearchParams({
          'filter[GROUP_ID]': groupId,
          'filter[STAGE_ID]': stageId,
          'filter[!STATUS]': 5,
          start,
        });
        // Только нужные поля — исключаем description, auditorsData, accomplicesData и т.д.
        ['ID', 'TITLE', 'STAGE_ID', 'RESPONSIBLE_ID', 'ACTIVITY_DATE'].forEach((field) => {
          params.append('select[]', field);
        });
        cmd[key] = `tasks.task.list?${params.toString()}`;
      });

      return axios.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      });
    }));
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

      return axios.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      });
    }));
  }

  getComments(taskId) {
    return axios.postForm('/rest/task.commentitem.getlist.json', {
      sessid: this.sessionId,
      TASKID: taskId,
    });
  }

  getTask(taskId, select = []) {
    const params = new URLSearchParams({ sessid: this.sessionId, taskId });
    select.forEach((field) => params.append('select[]', field));
    return axios.post('/rest/tasks.task.get.json', params);
  }

  removeNotifications(ids) {
    return axios.postForm('/rest/im.notify.delete.json', {
      sessid: this.sessionId,
      id: ids,
    });
  }

  /**
   * Обновляет поля задачи (tasks.task.update).
   * @param {string|number} taskId
   * @param {Record<string, any>} fields — объект с полями задачи, например { TITLE: 'Новое название' }
   */
  updateTask(taskId, fields) {
    const params = new URLSearchParams({
      sessid: this.sessionId,
      taskId,
    });
    Object.entries(fields).forEach(([key, value]) => {
      params.set(`fields[${key}]`, value);
    });
    return axios.post('/rest/tasks.task.update.json', params);
  }

  /**
   * Поиск задач по фильтрам с постраничной загрузкой через batch.
   * @param {Object} params
   * @param {string|null} params.title - поиск по названию (LIKE)
   * @param {boolean} params.smartTitleSearch - разбивать title по пробелам и искать каждое слово через AND
   * @param {'active'|'closed'|null} params.status - 'active' = не завершённые, 'closed' = завершённые, null = все
   * @param {'all'|'root'|'subtask'} params.parentType - 'root' = только корневые задачи, 'subtask' = только подзадачи, 'all' = все
   * @param {string|null} params.groupId - ID группы (null = глобальный поиск)
   * @param {string|number|null} params.createdBy - ID постановщика
   * @param {string|number|null} params.responsibleId - ID исполнителя
   * @param {Array<string|number>|null} params.stageIds - ID колонок канбана (мультиселект)
   * @param {string|null} params.createdDateFrom - дата создания от ('YYYY-MM-DD HH:mm:ss')
   * @param {string|null} params.createdDateTo - дата создания до
   * @param {string|null} params.changedDateFrom - дата изменения от
   * @param {string|null} params.changedDateTo - дата изменения до
   * @return {Promise<any[]>}
   */
  async searchTasks({ ids, title, smartTitleSearch, excludeTitle, status, parentType, groupId, createdBy, responsibleId, stageIds, createdDateFrom, createdDateTo, changedDateFrom, changedDateTo }) {
    const PAGE_SIZE = 50;
    const BATCH_SIZE = 50;

    const filter = {};
    if (ids?.length) filter['ID'] = ids;
    if (title) {
      const words = smartTitleSearch ? title.trim().split(/\s+/).filter(Boolean) : [];
      if (words.length > 1) {
        filter['::LOGIC'] = 'AND';
        words.forEach((word, i) => {
          filter[`::SUBFILTER-w${i}`] = { '%TITLE': word };
        });
      } else {
        filter['%TITLE'] = title;
      }
    }

    const excludeWords = excludeTitle ? excludeTitle.trim().split(/\s+/).filter(Boolean) : [];
    if (excludeWords.length) {
      if (!filter['::LOGIC']) filter['::LOGIC'] = 'AND';
      if (filter['%TITLE']) {
        filter['::SUBFILTER-title'] = { '%TITLE': filter['%TITLE'] };
        delete filter['%TITLE'];
      }
      excludeWords.forEach((word, i) => {
        filter[`::SUBFILTER-ex${i}`] = { '!%TITLE': word };
      });
    }
    if (status === 'active') filter['!STATUS'] = 5;
    if (status === 'closed') filter['STATUS'] = 5;
    if (parentType === 'root') filter['PARENT_ID'] = 0;
    if (parentType === 'subtask') filter['!PARENT_ID'] = 0;
    if (groupId) filter['GROUP_ID'] = groupId;
    if (createdBy) filter['CREATED_BY'] = createdBy;
    if (responsibleId) filter['RESPONSIBLE_ID'] = responsibleId;
    if (stageIds?.length) filter['STAGE_ID'] = stageIds;
    if (createdDateFrom) filter['>=CREATED_DATE'] = createdDateFrom;
    if (createdDateTo) filter['<=CREATED_DATE'] = createdDateTo;
    if (changedDateFrom) filter['>=CHANGED_DATE'] = changedDateFrom;
    if (changedDateTo) filter['<=CHANGED_DATE'] = changedDateTo;

    const selectFields = ['ID', 'TITLE', 'RESPONSIBLE_ID', 'CREATED_DATE', 'CHANGED_DATE', 'GROUP_ID', 'STAGE_ID'];

    const appendFilter = (params, keyPath, value) => {
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(`${keyPath}[]`, v));
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => appendFilter(params, `${keyPath}[${k}]`, v));
      } else {
        params.set(keyPath, value);
      }
    };

    const buildParams = (start) => {
      const params = new URLSearchParams({ start });
      Object.entries(filter).forEach(([key, value]) => {
        appendFilter(params, `filter[${key}]`, value);
      });
      selectFields.forEach((f) => params.append('select[]', f));
      return params;
    };

    const firstParams = buildParams(0);
    firstParams.set('sessid', this.sessionId);
    const { data: firstData } = await axios.post('/rest/tasks.task.list.json', firstParams);
    const tasks = firstData?.result?.tasks ?? [];
    const total = firstData?.total ?? 0;

    if (total > PAGE_SIZE) {
      const remainingStarts = [];
      for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
        remainingStarts.push(start);
      }

      const chunks = [];
      for (let i = 0; i < remainingStarts.length; i += BATCH_SIZE) {
        chunks.push(remainingStarts.slice(i, i + BATCH_SIZE));
      }

      const batchResponses = await Promise.all(chunks.map((chunk) => {
        const cmd = {};
        chunk.forEach((start) => {
          cmd[`p${start}`] = `tasks.task.list?${buildParams(start).toString()}`;
        });
        return axios.postForm('/rest/batch.json', {
          sessid: this.sessionId,
          halt: false,
          cmd,
        });
      }));

      batchResponses.forEach((response) => {
        Object.values(response.data.result.result).forEach((pageResult) => {
          tasks.push(...(pageResult.tasks ?? []));
        });
      });
    }

    return tasks;
  }

  /**
   * Возвращает все завершённые задачи группы за указанный диапазон дат (по CLOSED_DATE).
   * Первый запрос получает total, остальные страницы загружаются batch-ем.
   * @param {string} groupId
   * @param {string} dateFrom — формат 'YYYY-MM-DD HH:mm:ss'
   * @param {string} dateTo — формат 'YYYY-MM-DD HH:mm:ss'
   * @return {Promise<any[]>}
   */
  async getClosedTasks(groupId, dateFrom, dateTo) {
    const PAGE_SIZE = 50;
    const BATCH_SIZE = 50;

    function buildParams(start) {
      const params = new URLSearchParams({
        'filter[GROUP_ID]': groupId,
        'filter[STATUS]': 5,
        'filter[>=CLOSED_DATE]': dateFrom,
        'filter[<=CLOSED_DATE]': dateTo,
        start,
      });
      ['ID', 'TITLE', 'RESPONSIBLE_ID', 'CLOSED_DATE'].forEach((f) => params.append('select[]', f));
      return params;
    }

    // Первая страница — получаем задачи и total
    const firstParams = buildParams(0);
    firstParams.set('sessid', this.sessionId);
    const { data: firstData } = await axios.post('/rest/tasks.task.list.json', firstParams);
    const firstTasks = firstData?.result?.tasks ?? [];
    const total = firstData?.total ?? 0;

    if (total <= PAGE_SIZE) return firstTasks;

    // Оставшиеся страницы batch-ем
    const remainingStarts = [];
    for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
      remainingStarts.push(start);
    }

    const chunks = [];
    for (let i = 0; i < remainingStarts.length; i += BATCH_SIZE) {
      chunks.push(remainingStarts.slice(i, i + BATCH_SIZE));
    }

    const batchResponses = await Promise.all(chunks.map((chunk) => {
      const cmd = {};
      chunk.forEach((start) => {
        cmd[`p${start}`] = `tasks.task.list?${buildParams(start).toString()}`;
      });
      return axios.postForm('/rest/batch.json', {
        sessid: this.sessionId,
        halt: false,
        cmd,
      });
    }));

    const allTasks = [...firstTasks];
    batchResponses.forEach((response) => {
      Object.values(response.data.result.result).forEach((pageResult) => {
        allTasks.push(...(pageResult.tasks ?? []));
      });
    });

    return allTasks;
  }
}
