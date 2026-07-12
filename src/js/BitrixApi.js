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
    }).then(({data}) => {
      const memberIds = (data?.result ?? []).map((m) => m.USER_ID);
      if (!memberIds.length) return [];

      const params = new URLSearchParams({sessid: this.sessionId});
      memberIds.forEach((id) => params.append('filter[ID][]', id));

      return axios.post('/rest/user.get.json', params)
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
        ['ID', 'TITLE', 'STAGE_ID', 'RESPONSIBLE_ID', 'ACTIVITY_DATE', 'TASK_CONTROL'].forEach((field) => {
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

      return axios.postForm('/rest/batch.json', {
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
      return axios.postForm('/rest/batch.json', { sessid: this.sessionId, halt: false, cmd });
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
      return axios.postForm('/rest/batch.json', { sessid: this.sessionId, halt: false, cmd });
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
      return axios.postForm('/rest/batch.json', { sessid: this.sessionId, halt: false, cmd });
    })).then((responses) => responses.flatMap(
      ({data}) => Object.values(data?.result?.result ?? {}).filter(Boolean),
    ));
  }

  getTask(taskId, select = []) {
    const params = new URLSearchParams({sessid: this.sessionId, taskId});
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
  // Только скалярные поля — для массивов нужен params.append(`fields[KEY][]`, v) как в addTask
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

  favoriteTask(taskId) {
    return axios.postForm('/rest/tasks.task.favorite.add.json', {
      sessid: this.sessionId,
      taskId,
    });
  }

  unfavoriteTask(taskId) {
    return axios.postForm('/rest/tasks.task.favorite.remove.json', {
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
   * @return {Promise<any[]>}
   */
  async searchTasks({
                      ids,
                      favorite,
                      title,
                      smartTitleSearch,
                      excludeTitle,
                      status,
                      parentType,
                      groupId,
                      createdBy,
                      responsibleId,
                      stageIds,
                      createdDateFrom,
                      createdDateTo,
                      changedDateFrom,
                      changedDateTo,
                      closedDateFrom,
                      closedDateTo,
                      order = null,
                      extraSelectFields = [],
                      limit = null,
                    }) {
    const PAGE_SIZE = 50;
    const BATCH_SIZE = 50;

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
    if (groupId) filter['GROUP_ID'] = groupId;
    if (createdBy) filter['CREATED_BY'] = createdBy;
    if (responsibleId) filter['RESPONSIBLE_ID'] = responsibleId;
    if (stageIds?.length) filter['STAGE_ID'] = stageIds;
    if (createdDateFrom) filter['>=CREATED_DATE'] = createdDateFrom;
    if (createdDateTo) filter['<=CREATED_DATE'] = createdDateTo;
    if (changedDateFrom) filter['>=CHANGED_DATE'] = changedDateFrom;
    if (changedDateTo) filter['<=CHANGED_DATE'] = changedDateTo;
    if (closedDateFrom) filter['>=CLOSED_DATE'] = closedDateFrom;
    if (closedDateTo) filter['<=CLOSED_DATE'] = closedDateTo;

    const selectFields = [
      'ID', 'TITLE', 'RESPONSIBLE_ID', 'CREATED_DATE', 'CHANGED_DATE', 'CLOSED_DATE',
      'GROUP_ID', 'STAGE_ID', 'FAVORITE', 'PARENT_ID', ...extraSelectFields,
    ];

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
      const params = new URLSearchParams({start});
      Object.entries(filter).forEach(([key, value]) => {
        appendFilter(params, `filter[${key}]`, value);
      });
      selectFields.forEach((f) => params.append('select[]', f));
      if (order?.field) params.set(`order[${order.field}]`, order.direction ?? 'ASC');
      return params;
    };

    const firstParams = buildParams(0);
    firstParams.set('sessid', this.sessionId);
    const {data: firstData} = await axios.post('/rest/tasks.task.list.json', firstParams);
    const tasks = firstData?.result?.tasks ?? [];
    const total = firstData?.total ?? 0;
    const effectiveTotal = limit ? Math.min(total, limit) : total;

    if (effectiveTotal > PAGE_SIZE) {
      const remainingStarts = [];
      for (let start = PAGE_SIZE; start < effectiveTotal; start += PAGE_SIZE) {
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
        Object.values(response.data?.result?.result ?? {}).forEach((pageResult) => {
          tasks.push(...(pageResult.tasks ?? []));
        });
      });
    }

    return limit ? tasks.slice(0, limit) : tasks;
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
    return axios.post('/rest/tasks.task.add.json', params);
  }

  getCurrentUser() {
    return axios.postForm('https://plan.pixelplus.ru/rest/user.current.json', {
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
    return axios.post('/rest/task.commentitem.add.json', params);
  }

  searchTasksByFulltext(query) {
    return axios.postForm(
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
   * Batch-запрос tasks.task.get для нескольких задач (до 50 за раз).
   * Поля ответа в camelCase: id, responsibleId, createdBy, groupId, stageId.
   * @param {string[]} taskIds
   * @return {Promise<Record<string, object>>} Карта taskId → task
   */
  getTasksByIdsBatch(taskIds, select = ['ID', 'TITLE', 'RESPONSIBLE_ID', 'CREATED_BY', 'GROUP_ID', 'STAGE_ID', 'CREATED_DATE', 'CHANGED_DATE']) {
    if (!taskIds.length) return Promise.resolve({});
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
      chunks.push(taskIds.slice(i, i + CHUNK_SIZE));
    }
    return Promise.all(chunks.map((chunk, ci) => {
      const cmd = {};
      chunk.forEach((id, i) => {
        const params = new URLSearchParams({taskId: id});
        select.forEach((f) => params.append('select[]', f));
        cmd[`t${ci * CHUNK_SIZE + i}`] = `tasks.task.get?${params.toString()}`;
      });
      return axios.postForm('/rest/batch.json', {sessid: this.sessionId, halt: false, cmd});
    })).then((responses) => {
      const result = {};
      responses.forEach((response) => {
        Object.values(response.data?.result?.result ?? {}).forEach((val) => {
          const task = val?.task;
          if (task?.id) result[task.id] = task;
        });
      });
      return result;
    });
  }

  /**
   * Batch-запрос task.stages.get для нескольких групп.
   * @param {string[]} groupIds
   * @return {Promise<Record<string, object>>} Карта stageId → stage (UPPER_CASE поля)
   */
  getStagesBatch(groupIds) {
    if (!groupIds.length) return Promise.resolve({});
    const cmd = {};
    groupIds.forEach((id) => {
      cmd[`s${id}`] = `task.stages.get?entityId=${id}`;
    });
    return axios.postForm('/rest/batch.json', {sessid: this.sessionId, halt: false, cmd})
      .then(({data}) => {
        const stages = {};
        Object.values(data?.result?.result ?? {}).forEach((val) => {
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
    return axios.postForm('/rest/batch.json', {sessid: this.sessionId, halt: false, cmd})
      .then(({data}) => {
        const groups = {};
        Object.entries(data?.result?.result ?? {}).forEach(([key, val]) => {
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
    return axios.get(`/company/personal/user/${userId}/tasks/task/view/${taskId}/`).then(({data}) => {
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
    return axios.postForm('/rest/batch.json', {sessid: this.sessionId, halt: false, cmd})
      .then(({data}) => {
        const users = {};
        Object.values(data?.result?.result ?? {}).forEach((val) => {
          if (val?.id) users[String(val.id)] = val;
        });
        return users;
      });
  }
}
