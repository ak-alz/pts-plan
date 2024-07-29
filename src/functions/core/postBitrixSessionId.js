import getBitrixSessionId from "./getBitrixSessionId";

export default function postBitrixSessionId() {
  const sessionId = getBitrixSessionId();

  window.postMessage({
    type: "BX_SESSION_ID",
    text: sessionId,
  }, "*");
}
