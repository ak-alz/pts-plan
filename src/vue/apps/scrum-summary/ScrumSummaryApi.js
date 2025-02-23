import buildFormData from '@/functions/core/buildFormData';

export default class ScrumSummaryApi {
  constructor(bitrixSessionId) {
    this.bitrixSessionId = bitrixSessionId;
  }

  // Вовзращает все комментарии задачи
  getTaskComments(groupId, taskId) {
    return fetch(`/workgroups/group/${groupId}/tasks/task/view/${taskId}/?MID=1`, {
      method: 'GET',
      headers: {
        'x-bitrix-csrf-token': this.bitrixSessionId,
      },
    })
      .then((res) => res.text());
  }

  getColumnItems(groupId, columnId, pageId) {
    const formData = new FormData();
    buildFormData(formData, {
      pageId,
      columnId,
      params: {
        GROUP_ID: groupId,
      },
    });

    return fetch('/bitrix/services/main/ajax.php?mode=class&c=bitrix:tasks.kanban&action=getColumnItems', {
      method: 'POST',
      headers: {
        'x-bitrix-csrf-token': this.bitrixSessionId,
      },
      body: formData,
    })
      .then((res) => res.json());
  }
}
