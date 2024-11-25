import stylesInjection from '@/functions/styles';
import scriptsInjection from '@/functions/common';
import alertScriptsInjection from '@/functions/alert';
import setEventListeners from '@/functions/core/setEventListeners';

const init = () => {
  chrome?.storage?.local?.get(['options', 'sessid'])
    .then(({ options, sessid }) => {
      if (!options || !sessid) return;

      // Инъекция стилей
      stylesInjection(options);

      // навешиваем обработчики
      scriptsInjection(options, sessid);

      if (window.location.href.includes('/alert/')) {
        alertScriptsInjection(options);
      }

      setEventListeners(() => {
        scriptsInjection(options, sessid);
      });
    });
};

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type && event.data.type === 'BX_SESSION_ID') {
    // id сессии пользователя. Вытаскивается при DOMContentLoaded
    if (event.data.text) {
      // Тут делаю так, потому что ifram`ы не отдают id сессии и всё ломается
      // Поэтому если мы 1 раз успешно получили id сессии,
      // то сохраняем его в глобальные настройки и переиспользуем
      chrome?.storage?.local?.set({
        sessid: event.data.text,
      }).then(init);
    } else {
      init();
    }
  }
});
