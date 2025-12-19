import axios from 'axios';

export default class BitrixApi {
  constructor(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Возвращает все колонки канбана, а также максимум 20 задач для каждой из колонок
   * @param groupId
   * @return {Promise<axios.AxiosResponse<any>>}
   */
  applyFilter(groupId) {
    return axios.postForm('/bitrix/services/main/ajax.php?mode=class&c=bitrix:tasks.kanban&action=applyFilter', {
      params: {
        GROUP_ID: groupId,
      },
    }, {
      headers: {
        'x-bitrix-csrf-token': this.sessionId,
      },
    });
  }

  getColumnItems(groupId, columnId, page) {
    return axios.postForm('/bitrix/services/main/ajax.php?mode=class&c=bitrix:tasks.kanban&action=getColumnItems', {
      pageId: page,
      columnId,
      params: {
        GROUP_ID: groupId,
      },
    }, {
      headers: {
        'x-bitrix-csrf-token': this.sessionId,
      },
    });
  }

  completeTask(groupId, columnId, taskId) {
    return axios.postForm('/bitrix/services/main/ajax.php?mode=class&c=bitrix:tasks.kanban&action=completeTask', {
      columnId,
      taskId,
      params: {
        GROUP_ID: groupId,
      },
    }, {
      headers: {
        'x-bitrix-csrf-token': this.sessionId,
      },
    });
  }

  renewTask(taskId) {
    return axios.postForm('/bitrix/services/main/ajax.php?mode=class&c=bitrix:tasks.task&action=renew', {
      taskId,
    }, {
      headers: {
        'x-bitrix-csrf-token': this.sessionId,
      },
    });
  }

  static getTaskCommentsUrl(groupId, taskId) {
    return `/workgroups/group/${groupId}/tasks/task/view/${taskId}/?MID=1`;
  }

  getTaskCommentsRaw(groupId, taskId) {
    return axios.get(BitrixApi.getTaskCommentsUrl(groupId, taskId), {
      headers: {
        'x-bitrix-csrf-token': this.sessionId,
      },
    });
  }

  /**
   *
   * @param groupId
   * @param taskId
   * @return {Promise<*[HTMLElement]>}
   */
  getTaskComments(groupId, taskId) {
    return this.getTaskCommentsRaw(groupId, taskId)
      .then(({data}) => {
        const parser = new DOMParser();
        const html = parser.parseFromString(data, 'text/html');

        return [...html.querySelectorAll('.feed-com-block:not(.mpl-comment-aux) .feed-com-text-inner-inner')];
      });
  }

  static getUserNotifications(taskId) {
    return axios.get('/alert/')
      .then(({data}) => {
        const parser = new DOMParser();
        const html = parser.parseFromString(data, 'text/html');

        if (taskId) {
          return [...html.querySelectorAll(`.message-item:has(a[href*="/tasks/task/view/${taskId}/"]) .message-delete-checkbox[data-id]:not([data-id=""])`)];
        }

        return [...html.querySelectorAll('.message-delete-checkbox[data-id]:not([data-id=""])')];
      });
  }

  removeNotifications(ids) {
    return axios.postForm('/rest/im.notify.delete.json', {
      sessid: this.sessionId,
      id: ids,
    });
  }
}
