import buildFormData from '@/functions/core/buildFormData';

export default class ScrumPointsApi {
  constructor(bitrixSessionId) {
    this.bitrixSessionId = bitrixSessionId;
  }

  // Вовзращает все колонки канбана а также часть пользователей, если повезёт
  getInitialData(groupId) {
    const formData = new FormData();
    buildFormData(formData, {
      params: {
        GROUP_ID: groupId,
      },
    });

    return fetch('/bitrix/services/main/ajax.php?mode=class&c=bitrix:tasks.kanban&action=applyFilter', {
      method: 'POST',
      headers: {
        'x-bitrix-csrf-token': this.bitrixSessionId,
      },
      body: formData,
    })
      .then((res) => res.json());
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
