import {useToast} from 'primevue/usetoast';
import {onUnmounted, ref, watch} from 'vue';

// Опрос конкретной AI-задачи (report_id) не привязан к жизненному циклу Vue-компонента — если виджет
// закрыть до получения ответа, промис из startJob() продолжает выполняться. Реестр не даёт второму
// экземпляру композабла (например, после повторного открытия того же виджета) запустить дублирующий
// опрос того же ключа — он просто дожидается уже идущего промиса.
const activePolls = new Map();

/**
 * Управляет жизненным циклом одной AI-задачи PixelTools в рамках виджета: состояние загрузки/прогресса,
 * персистентность report_id в chrome.storage.local (чтобы восстановить опрос, если виджет был закрыт до
 * получения ответа) и единообразную обработку ошибок с тостом. Не знает, как строить промпт и что делать
 * с результатом — это остаётся на стороне вызывающего компонента.
 * @param {() => string} getStorageKey - возвращает ключ хранения задачи (обычно зависит от groupId/taskId).
 * @param {{group: string, onAuthError?: () => void}} config - группа тостов компонента и коллбек, вызываемый при невалидном/отсутствующем API-ключе.
 * @returns {{
 *   loading: import('vue').Ref<boolean>,
 *   progress: import('vue').Ref<number|null>,
 *   getApiKey: () => Promise<string|null>,
 *   forget: () => Promise<void>,
 *   getPendingJob: () => Promise<{reportId: string, progress?: number}|null>,
 *   chatCallbacks: () => {onStart: (reportId: string) => void, onProgress: (progress: number) => void},
 *   resumeProgressCallback: (reportId: string) => (progress: number) => void,
 *   runJob: (startJob: () => Promise<string>, onSuccess?: (result: string) => (void|Promise<void>)) => Promise<void>,
 * }} API для запуска, восстановления и отслеживания AI-задачи.
 */
export function useAiJob(getStorageKey, {group, onAuthError} = {}) {
  const toast = useToast();
  const loading = ref(false);
  const progress = ref(null);
  let unmounted = false;
  onUnmounted(() => { unmounted = true; });

  async function getApiKey() {
    const {options} = await chrome.storage.local.get(['options']);
    return options?.pixelToolsApiKey ?? null;
  }

  async function forget() {
    await chrome.storage.local.remove([getStorageKey()]);
  }

  async function getPendingJob() {
    const stored = await chrome.storage.local.get([getStorageKey()]);
    return stored[getStorageKey()] ?? null;
  }

  function persist(reportId, currentProgress) {
    chrome.storage.local.set({[getStorageKey()]: {reportId, progress: currentProgress}});
  }

  function chatCallbacks() {
    let reportId = null;
    return {
      onStart: (id) => {
        reportId = id;
        persist(id, 1);
      },
      onProgress: (p) => {
        progress.value = p;
        if (reportId) persist(reportId, p);
      },
    };
  }

  function resumeProgressCallback(reportId) {
    return (p) => {
      progress.value = p;
      persist(reportId, p);
    };
  }

  async function runJob(startJob, onSuccess) {
    const key = getStorageKey();
    loading.value = true;

    const existing = activePolls.get(key);
    if (existing) {
      // Опрос этого же ключа уже идёт (запущен осиротевшим экземпляром после закрытия виджета) —
      // не дублируем сетевой запрос, просто зеркалим его прогресс и ждём тот же результат.
      const stopProgressMirror = watch(existing.progress, (p) => { progress.value = p; }, {immediate: true});
      try {
        const result = await existing.promise;
        if (onSuccess) await onSuccess(result);
      } catch (e) {
        if (!unmounted) {
          toast.add({ group, severity: 'error', summary: 'AI', detail: e.message, life: 5000 });
          if (e.isAuthError && onAuthError) onAuthError();
        }
      } finally {
        stopProgressMirror();
        loading.value = false;
        progress.value = null;
      }
      return;
    }

    const promise = startJob();
    const entry = {promise, progress};
    activePolls.set(key, entry);

    try {
      const result = await promise;
      if (!unmounted) {
        if (onSuccess) await onSuccess(result);
        await forget();
      }
      // Если виджет закрыли, пока задача считалась — оставляем {reportId, progress} в storage как есть
      // (не забываем). При следующем открытии getPendingJob() найдёт report_id и виджет сам сделает
      // ещё один resumeChat — раз задача на сервере уже готова, он сразу вернёт готовый ответ.
    } catch (e) {
      // Задача завершилась ошибкой (или устарела) — продолжать её опрос при следующем открытии виджета нет смысла
      await forget();
      if (!unmounted) {
        toast.add({ group, severity: 'error', summary: 'AI', detail: e.message, life: 5000 });
        if (e.isAuthError && onAuthError) onAuthError();
      }
    } finally {
      if (activePolls.get(key) === entry) activePolls.delete(key);
      loading.value = false;
      progress.value = null;
    }
  }

  return { loading, progress, getApiKey, forget, getPendingJob, chatCallbacks, resumeProgressCallback, runJob };
}
