export default function getBitrixSessionId() {
  if (window.bxSession && window.bxSession.sessid) {
    return window.bxSession.sessid;
  }

  if (window.phpVars && window.phpVars.bitrix_sessid) {
    return window.phpVars.bitrix_sessid;
  }

  return '';
}
