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

  // Отправляем Session Id из сайта в расширение
  function postBitrixSessionId() {
    const sessionId = getBitrixSessionId();

    window.postMessage({
      key: 'BX_SESSION_ID',
      data: sessionId,
    }, '*');
  }

  postBitrixSessionId();
})();
