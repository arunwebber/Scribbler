chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: "popup.html"
  });
});

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
    .then(data => {
      console.log('Image generation response:', data);
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error('API Error:', error);
      sendResponse({ success: false, error: error.toString() });
    });

    return true;
  } else if (request.action === 'checkStatus') {
    // Correct endpoint
    const statusUrl = `https://api.imaginepro.ai/api/v1/message/fetch/${request.messageId}`;
    
    console.log('Checking status at:', statusUrl);
    
    fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${request.apiKey}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Status response:', data);
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error('Status Check Error:', error);
      sendResponse({ success: false, error: error.toString() });
    });
      
    return true;
  }
});