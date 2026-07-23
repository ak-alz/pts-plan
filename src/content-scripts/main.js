(() => {
  function getBitrixSessionId() {
    if (window.BX?.bitrix_sessid) {
      return window.BX.bitrix_sessid();
    }

    if (window.phpVars?.bitrix_sessid) {
      return window.phpVars.bitrix_sessid;
    }

    if (window.bxSession?.sessid) {
      return window.bxSession.sessid;
    }

    const sessidInput = document.querySelector('input[name="sessid"]');
    if (sessidInput?.value) {
      return sessidInput.value;
    }

    return '';
  }

  // Отправляем Session Id из сайта в расширение. targetOrigin — только текущий origin, а не '*':
  // sessid это CSRF-токен сессии, и с '*' его прочитал бы любой сторонний скрипт или iframe страницы
  function postBitrixSessionId() {
    const sessionId = getBitrixSessionId();

    window.postMessage({
      key: 'BX_SESSION_ID',
      data: sessionId,
    }, window.location.origin);
  }

  postBitrixSessionId();
})();
