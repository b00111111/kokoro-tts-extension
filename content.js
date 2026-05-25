// Returns the current text selection when requested by the background service worker.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    sendResponse({ text: window.getSelection().toString() });
  }
  return true;
});
