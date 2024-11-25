import getBitrixSessionId from './getBitrixSessionId';

// Отправляет Bitrix Session Id из сайта в расширение
export default function postBitrixSessionId() {
  const sessionId = getBitrixSessionId();

  window.postMessage({
    type: 'BX_SESSION_ID',
    text: sessionId,
  }, '*');
}
