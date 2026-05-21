import { ref } from 'vue';

import BitrixApi from '../js/BitrixApi.js';

export function useAutoFill(model) {
  const isFetching = ref(false);
  const fetchError = ref(false);

  async function autoFill() {
    isFetching.value = true;
    fetchError.value = false;
    try {
      const { sessionId } = await chrome.storage.local.get(['sessionId']);
      const user = await new BitrixApi(sessionId).getCurrentUser();
      if (!user) throw new Error();
      model.value.userFirstName = user.NAME ?? '';
      model.value.userLastName = user.LAST_NAME ?? '';
      model.value.userId = Number(user.ID) || null;
    } catch {
      fetchError.value = true;
    } finally {
      isFetching.value = false;
    }
  }

  return { autoFill, isFetching, fetchError };
}
