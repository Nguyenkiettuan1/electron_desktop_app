// Background script for URL detection
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCurrentUrl') {
        // Get current tab URL
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                sendResponse({
                    success: true,
                    url: tabs[0].url,
                    title: tabs[0].title
                });
            } else {
                sendResponse({
                    success: false,
                    error: 'No active tab found'
                });
            }
        });
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'sendUrlToApp') {
        // Send URL to Electron app via HTTP request
        fetch('http://localhost:3000/api/url-detected', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: request.url,
                title: request.title,
                timestamp: new Date().toISOString()
            })
        }).then(response => {
            if (response.ok) {
                sendResponse({success: true});
            } else {
                sendResponse({success: false, error: 'Failed to send URL to app'});
            }
        }).catch(error => {
            sendResponse({success: false, error: error.message});
        });
        return true;
    }
    
    if (request.action === 'autoSendCurrentUrl') {
        // Automatically get current URL and send to app
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                // Send URL to Electron app automatically
                fetch('http://localhost:3000/api/url-detected', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: tabs[0].url,
                        title: tabs[0].title,
                        timestamp: new Date().toISOString()
                    })
                }).then(response => {
                    if (response.ok) {
                        console.log('URL automatically sent to Electron app:', tabs[0].url);
                        sendResponse({success: true, url: tabs[0].url});
                    } else {
                        console.error('Failed to send URL to app');
                        sendResponse({success: false, error: 'Failed to send URL to app'});
                    }
                }).catch(error => {
                    console.error('Error sending URL to app:', error);
                    sendResponse({success: false, error: error.message});
                });
            } else {
                sendResponse({success: false, error: 'No active tab found'});
            }
        });
        return true;
    }
});

// Listen for tab changes and auto-send URL
chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log('Tab activated:', activeInfo.tabId);
    // Get the active tab and send URL
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab && tab.url && tab.url.startsWith('http')) {
            console.log('Sending URL from activated tab:', tab.url);
            sendUrlToElectronApp(tab.url, tab.title);
        }
    });
});

// Listen for tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        console.log('Tab updated, sending URL:', tab.url);
        sendUrlToElectronApp(tab.url, tab.title);
    }
});

// Function to send URL to Electron app
function sendUrlToElectronApp(url, title) {
    fetch('http://localhost:3000/api/url-detected', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: url,
            title: title,
            timestamp: new Date().toISOString()
        })
    }).then(response => {
        if (response.ok) {
            console.log('URL automatically sent to Electron app:', url);
        } else {
            console.error('Failed to send URL to app');
        }
    }).catch(error => {
        console.error('Error sending URL to app:', error);
    });
}

// Listen for requests from Electron app
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'electron-app') {
        port.onMessage.addListener((msg) => {
            if (msg.action === 'requestCurrentUrl') {
                // Automatically get current URL and send to app
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    if (tabs[0] && tabs[0].url) {
                        // Send URL to Electron app automatically
                        fetch('http://localhost:3000/api/url-detected', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                url: tabs[0].url,
                                title: tabs[0].title,
                                timestamp: new Date().toISOString()
                            })
                        }).then(response => {
                            if (response.ok) {
                                console.log('URL automatically sent to Electron app:', tabs[0].url);
                                port.postMessage({success: true, url: tabs[0].url});
                            } else {
                                console.error('Failed to send URL to app');
                                port.postMessage({success: false, error: 'Failed to send URL to app'});
                            }
                        }).catch(error => {
                            console.error('Error sending URL to app:', error);
                            port.postMessage({success: false, error: error.message});
                        });
                    } else {
                        port.postMessage({success: false, error: 'No active tab found'});
                    }
                });
            }
        });
    }
});
