import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';

import BitrixApi from '../js/BitrixApi.js';

const ERROR_DETAIL = 'Откройте сайт plan.pixelplus.ru и войдите в аккаунт — после этого расширение сможет подтянуть ваши имя и ID. Если сайт уже открыт, обновите вкладку и попробуйте снова.';

export function useAutoFill(model) {
  const toast = useToast();
  const isFetching = ref(false);

  async function autoFill() {
    isFetching.value = true;
    try {
      const { sessionId } = await chrome.storage.local.get(['sessionId']);
      const user = await new BitrixApi(sessionId).getCurrentUser();
      if (!user) throw new Error();
      model.value.userFirstName = user.NAME ?? '';
      model.value.userLastName = user.LAST_NAME ?? '';
      model.value.userId = Number(user.ID) || null;
    } catch {
      toast.add({
        severity: 'error',
        summary: 'Не удалось получить данные',
        detail: ERROR_DETAIL,
        life: 10000,
      });
    } finally {
      isFetching.value = false;
    }
  }

  return { autoFill, isFetching };
}
