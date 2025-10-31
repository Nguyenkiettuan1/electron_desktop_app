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

// Track last sent URL to prevent duplicates
let lastSentUrl = null;
let lastSentTabId = null;

// Helper function to send active tab URL immediately
function sendActiveTabUrl(forceSend = false) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url && activeTab.url.startsWith('http')) {
            // Always send when switching tabs (forceSend) or when URL/tab changed
            if (forceSend || activeTab.url !== lastSentUrl || activeTab.id !== lastSentTabId) {
                console.log('⚡ Sending URL immediately from active tab:', activeTab.url, '(tabId:', activeTab.id, ')');
                sendUrlToElectronApp(activeTab.url, activeTab.title, activeTab.id);
                lastSentUrl = activeTab.url;
                lastSentTabId = activeTab.id;
            } else {
                console.log('⏭️ URL unchanged, skipping send');
            }
        } else {
            console.log('⚠️ No active tab with valid URL found');
        }
    });
}

// Listen for tab changes and auto-send URL ONLY from active tab - INSTANT
chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log('🔍 Tab activated:', activeInfo.tabId);
    
    // Send immediately when tab is activated
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab && tab.url && tab.url.startsWith('http')) {
            // Check if URL or tab changed
            if (tab.url !== lastSentUrl || tab.id !== lastSentTabId) {
                console.log('⚡ Sending URL immediately from activated tab:', tab.url);
                sendUrlToElectronApp(tab.url, tab.title, tab.id);
                lastSentUrl = tab.url;
                lastSentTabId = tab.id;
            }
        }
    });
});

// Listen for tab removal - send URL of newly active tab - INSTANT
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log('🗑️ Tab closed:', tabId);
    
    // If the closed tab was the one we last sent, reset tracking
    if (tabId === lastSentTabId) {
        lastSentUrl = null;
        lastSentTabId = null;
    }
    
    // Send immediately after tab closure (Chrome updates active tab synchronously)
    sendActiveTabUrl(true); // Force send to update to new active tab
});

// Listen for tab updates (URL changes) - ONLY for active tab - INSTANT
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Detect URL changes immediately (even before page loads completely)
    // This catches: clicking links, navigating, hash changes, etc.
    if (changeInfo.url && tab.url && tab.url.startsWith('http')) {
        // Verify this tab is currently active
        chrome.tabs.query({active: true, currentWindow: true}, (activeTabs) => {
            const activeTab = activeTabs[0];
            
            // Only send if this updated tab is the active tab
            if (activeTab && activeTab.id === tabId) {
                // Check if URL actually changed
                if (tab.url !== lastSentUrl || tabId !== lastSentTabId) {
                    console.log('⚡ URL changed in active tab, sending immediately:', tab.url);
                    sendUrlToElectronApp(tab.url, tab.title, tabId);
                    lastSentUrl = tab.url;
                    lastSentTabId = tabId;
                }
            }
        });
        return; // Exit early if we handled URL change
    }
    
    // Also handle when page completes loading (for initial page loads)
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        chrome.tabs.query({active: true, currentWindow: true}, (activeTabs) => {
            const activeTab = activeTabs[0];
            if (activeTab && activeTab.id === tabId) {
                // Only send if URL changed
                if (tab.url !== lastSentUrl || tabId !== lastSentTabId) {
                    console.log('⚡ Page loaded in active tab, sending URL:', tab.url);
                    sendUrlToElectronApp(tab.url, tab.title, tabId);
                    lastSentUrl = tab.url;
                    lastSentTabId = tabId;
                }
            }
        });
    }
});

// Function to send URL to Electron app
function sendUrlToElectronApp(url, title, tabId) {
    fetch('http://localhost:3000/api/url-detected', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: url,
            title: title,
            tabId: tabId,
            timestamp: new Date().toISOString()
        })
    }).then(response => {
        if (response.ok) {
            console.log('✅ URL sent to Electron app:', url, '(tabId:', tabId, ')');
        } else {
            console.error('❌ Failed to send URL to app');
        }
    }).catch(error => {
        console.error('❌ Error sending URL to app:', error);
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
