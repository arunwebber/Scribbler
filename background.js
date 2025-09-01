chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: "popup.html"
  });
});

// You NEED this code - without it, you'll get CORS errors
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callAiApi') {
    fetch(request.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${request.apiKey}`
      },
      body: JSON.stringify({
        prompt: request.prompt,
        ref: "",
        webhookOverride: "",
        timeout: 900
      })
    })
    .then(response => response.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(error => sendResponse({ success: false, error: error.toString() }));

    return true; // Will respond asynchronously
  }
});