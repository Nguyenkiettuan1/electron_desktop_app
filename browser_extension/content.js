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

// ❌ REMOVED: Content script should NOT auto-send URLs
// Only background.js should send URLs from active tab
// This prevents multiple tabs from sending URLs simultaneously

// Content script only sends when:
// 1. User manually triggers (keyboard shortcut Ctrl+Shift+U)
// 2. Background script requests it via message
// 3. Electron app requests it
