// Popup script for browser extension
document.addEventListener('DOMContentLoaded', () => {
    const urlDisplay = document.getElementById('url-display');
    const sendUrlBtn = document.getElementById('send-url-btn');
    const copyUrlBtn = document.getElementById('copy-url-btn');
    const autoSendToggle = document.getElementById('auto-send-toggle');
    const status = document.getElementById('status');
    
    let currentUrl = '';
    let currentTitle = '';
    
    // Load auto-send status
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'getAutoSendStatus'}, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Extension not ready yet:', chrome.runtime.lastError.message);
                    return;
                }
                if (response && response.enabled !== undefined) {
                    autoSendToggle.checked = response.enabled;
                }
            });
        }
    });
    
    // Get current URL when popup opens
    chrome.runtime.sendMessage({action: 'getCurrentUrl'}, (response) => {
        if (response.success) {
            currentUrl = response.url;
            currentTitle = response.title;
            urlDisplay.innerHTML = `
                <strong>${currentTitle}</strong><br>
                <small>${currentUrl}</small>
            `;
        } else {
            urlDisplay.innerHTML = '❌ Could not get current URL';
            status.innerHTML = response.error;
            status.className = 'status error';
        }
    });
    
    // Send URL to Electron app
    sendUrlBtn.addEventListener('click', () => {
        if (!currentUrl) {
            status.innerHTML = 'No URL available';
            status.className = 'status error';
            return;
        }
        
        status.innerHTML = 'Sending URL to app...';
        status.className = 'status';
        
        chrome.runtime.sendMessage({
            action: 'sendUrlToApp',
            url: currentUrl,
            title: currentTitle
        }, (response) => {
            if (response.success) {
                status.innerHTML = '✅ URL sent successfully!';
                status.className = 'status success';
            } else {
                status.innerHTML = '❌ Failed to send URL: ' + response.error;
                status.className = 'status error';
            }
        });
    });
    
    // Copy URL to clipboard
    copyUrlBtn.addEventListener('click', () => {
        if (!currentUrl) {
            status.innerHTML = 'No URL available';
            status.className = 'status error';
            return;
        }
        
        navigator.clipboard.writeText(currentUrl).then(() => {
            status.innerHTML = '✅ URL copied to clipboard!';
            status.className = 'status success';
        }).catch(err => {
            status.innerHTML = '❌ Failed to copy URL';
            status.className = 'status error';
        });
    });
    
    // Toggle auto-send feature
    autoSendToggle.addEventListener('change', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleAutoSend',
                    enabled: autoSendToggle.checked
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('Extension not ready yet:', chrome.runtime.lastError.message);
                        status.innerHTML = '⚠️ Extension not ready, try refreshing the page';
                        status.className = 'status error';
                        return;
                    }
                    if (response && response.success) {
                        status.innerHTML = autoSendToggle.checked ? 
                            '✅ Auto-send enabled' : '❌ Auto-send disabled';
                        status.className = 'status ' + (autoSendToggle.checked ? 'success' : 'error');
                    }
                });
            }
        });
    });
});
