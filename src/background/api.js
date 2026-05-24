chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'pixeltools-api-fetch') return false;

  const { method, url, body, params } = message;
  const fullUrl = params ? `${url}?${new URLSearchParams(params)}` : url;

  fetch(fullUrl, {
    method: method ?? 'GET',
    headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
    body: body ? new URLSearchParams(body).toString() : undefined,
  })
    .then((res) => res.json())
    .then((data) => sendResponse({ data }))
    .catch((err) => sendResponse({ error: err.message }));

  return true; // держим канал открытым для async ответа
});
