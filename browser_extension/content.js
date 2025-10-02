// Content script for browser extension
// This script runs on every webpage

// Auto-send feature (can be toggled)
let autoSendEnabled = true;
let lastSentUrl = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageInfo') {
        sendResponse({
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname
        });
    }
    
    if (request.action === 'autoSendCurrentUrl') {
        // Automatically send current URL to app
        sendCurrentUrlToApp();
        sendResponse({success: true});
    }
    
    if (request.action === 'toggleAutoSend') {
        autoSendEnabled = request.enabled;
        sendResponse({success: true, enabled: autoSendEnabled});
    }
    
    if (request.action === 'getAutoSendStatus') {
        sendResponse({enabled: autoSendEnabled});
    }
});

// Auto-detect when user is on a webpage and send URL to app
// This can be triggered by keyboard shortcut or automatically
function sendCurrentUrlToApp() {
    const url = window.location.href;
    const title = document.title;
    
    // Send to Electron app
    fetch('http://localhost:3000/api/url-detected', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: url,
            title: title,
            domain: window.location.hostname,
            timestamp: new Date().toISOString()
        })
    }).then(response => {
        if (response.ok) {
            console.log('URL sent to Test Automation app:', url);
        } else {
            console.error('Failed to send URL to app');
        }
    }).catch(error => {
        console.error('Error sending URL to app:', error);
    });
}

// Listen for keyboard shortcut (Ctrl+Shift+U)
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key === 'U') {
        event.preventDefault();
        sendCurrentUrlToApp();
    }
});

// Listen for global keyboard shortcut from Electron app (Ctrl+Alt+S)
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.altKey && event.key === 'S') {
        // This is triggered when Electron app takes screenshot
        // Automatically send current URL
        console.log('Ctrl+Alt+S detected, sending URL to Electron app...');
        setTimeout(() => {
            sendCurrentUrlToApp();
        }, 100); // Small delay to ensure URL is captured
    }
});

// Also listen for the exact key combination that Electron app uses
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.altKey && event.key === 's') {
        console.log('Ctrl+Alt+s detected, sending URL to Electron app...');
        setTimeout(() => {
            sendCurrentUrlToApp();
        }, 100);
    }
});

// Auto-send URL when page changes (if enabled)
setInterval(() => {
    if (!autoSendEnabled) return;
    
    const currentUrl = window.location.href;
    if (currentUrl !== lastSentUrl && currentUrl.startsWith('http')) {
        console.log('URL changed, sending to Electron app:', currentUrl);
        sendCurrentUrlToApp();
        lastSentUrl = currentUrl;
    }
}, 1000); // Check every 1 second for faster response

// Also send URL immediately when page loads (if enabled)
console.log('Content script loaded, autoSendEnabled:', autoSendEnabled);
if (autoSendEnabled) {
    console.log('Page loaded, sending URL immediately...');
    setTimeout(() => {
        sendCurrentUrlToApp();
    }, 1000);
}

// Force send URL for testing
console.log('Force sending URL for testing...');
setTimeout(() => {
    sendCurrentUrlToApp();
}, 1000);

// Also send immediately
console.log('Sending URL immediately...');
sendCurrentUrlToApp();

// Listen for tab changes and send URL immediately
window.addEventListener('beforeunload', () => {
    console.log('Tab unloading, sending URL...');
    sendCurrentUrlToApp();
});

// Listen for page unload
window.addEventListener('unload', () => {
    console.log('Page unloading, sending URL...');
    sendCurrentUrlToApp();
});

// Listen for page show (when tab becomes active)
window.addEventListener('pageshow', () => {
    if (!autoSendEnabled) return;
    console.log('Page shown, sending URL...');
    sendCurrentUrlToApp();
});

// Listen for page hide (when tab becomes inactive)
window.addEventListener('pagehide', () => {
    if (!autoSendEnabled) return;
    console.log('Page hidden, sending URL...');
    sendCurrentUrlToApp();
});

// Auto-send URL when page loads or becomes active (if enabled)
window.addEventListener('load', () => {
    if (!autoSendEnabled) return;
    console.log('Page loaded, sending URL to Electron app...');
    setTimeout(() => {
        sendCurrentUrlToApp();
    }, 500);
});

// Auto-send URL when tab becomes active (if enabled)
document.addEventListener('visibilitychange', () => {
    if (!autoSendEnabled) return;
    if (!document.hidden) {
        console.log('Tab became active, sending URL to Electron app...');
        // Send immediately, no timeout
        sendCurrentUrlToApp();``
    }
});

// Auto-send URL when page focus (if enabled)
window.addEventListener('focus', () => {
    if (!autoSendEnabled) return;
    console.log('Window focused, sending URL to Electron app...');
    // Send immediately, no timeout
    sendCurrentUrlToApp();
});

// Auto-send URL when window becomes active (if enabled)
window.addEventListener('activate', () => {
    if (!autoSendEnabled) return;
    console.log('Window activated, sending URL to Electron app...');
    sendCurrentUrlToApp();
});

// Auto-send URL when page becomes visible (if enabled)
document.addEventListener('visibilitychange', () => {
    if (!autoSendEnabled) return;
    if (document.visibilityState === 'visible') {
        console.log('Page became visible, sending URL to Electron app...');
        sendCurrentUrlToApp();
    }
});
