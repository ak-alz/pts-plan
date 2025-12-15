(() => {
  function getBitrixSessionId() {
    if (window.phpVars?.bitrix_sessid) {
      return window.phpVars.bitrix_sessid;
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
