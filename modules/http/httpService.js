// HTTP Service Module - Handles HTTP server for browser extension communication
const http = require('http');
const url = require('url');

class HttpService {
    constructor() {
        this.httpServer = null;
        this.isRequestingUrl = false;
        this.currentUrl = null;
        this.mainWindow = null;
        this.lastUrlRequest = null; // Track most recent URL request to prevent stale requests
    }

    setMainWindow(window) {
        this.mainWindow = window;
    }

    setCurrentUrl(url) {
        this.currentUrl = url;
    }

    getCurrentUrl() {
        return this.currentUrl;
    }

    startHttpServer() {
        try {
            this.httpServer = http.createServer((req, res) => {
                const parsedUrl = url.parse(req.url, true);
                
                // Enable CORS for browser extension
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                
                if (req.method === 'OPTIONS') {
                    res.writeHead(200);
                    res.end();
                    return;
                }
                
                if (parsedUrl.pathname === '/api/url-detected' && req.method === 'POST') {
                    this.handleUrlDetected(req, res);
                } else if (parsedUrl.pathname === '/api/request-url' && req.method === 'POST') {
                    this.handleRequestUrl(req, res);
                } else if (parsedUrl.pathname === '/api/trigger-extension' && req.method === 'POST') {
                    this.handleTriggerExtension(req, res);
                } else if (parsedUrl.pathname === '/api/check-request' && req.method === 'GET') {
                    this.handleCheckRequest(req, res);
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Not found' }));
                }
            });
            
            this.httpServer.listen(3000, 'localhost', () => {
                console.log('HTTP server started on http://localhost:3000');
                console.log('Browser extension can now send URLs to this app');
            });
            
        } catch (error) {
            console.error('Failed to start HTTP server:', error);
        }
    }

    handleUrlDetected(req, res) {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const receivedUrl = data.url;
                const receivedTabId = data.tabId;
                const receivedTimestamp = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
                
                console.log('🔍 URL received from browser extension:', {
                    url: receivedUrl,
                    tabId: receivedTabId,
                    timestamp: new Date(receivedTimestamp).toISOString()
                });
                
                // Track the most recent URL request
                if (!this.lastUrlRequest || receivedTimestamp > this.lastUrlRequest.timestamp) {
                    console.log('✅ Accepting URL from active tab:', receivedUrl);
                    
                    // Store the URL
                    this.currentUrl = receivedUrl;
                    this.isRequestingUrl = false;
                    this.lastUrlRequest = {
                        url: receivedUrl,
                        tabId: receivedTabId,
                        timestamp: receivedTimestamp
                    };
                    
                    // Send to renderer process
                    if (this.mainWindow) {
                        this.mainWindow.webContents.send('url-detected', receivedUrl);
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, accepted: true }));
                } else {
                    console.log('⏭️ Ignoring stale URL request:', {
                        received: receivedUrl,
                        lastAccepted: this.lastUrlRequest.url,
                        timeDiff: receivedTimestamp - this.lastUrlRequest.timestamp
                    });
                    
                    // Still respond success but don't update
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, accepted: false, reason: 'stale_request' }));
                }
            } catch (error) {
                console.error('❌ Error parsing URL data:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
    }

    handleRequestUrl(req, res) {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                console.log('Electron app requesting current URL...');
                
                // Send message to browser extension to get current URL
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('request-current-url');
                }
                
                // Also try to trigger extension directly via HTTP
                this.triggerExtensionUrlDetection();
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: 'Request sent to browser extension' 
                }));
            } catch (error) {
                console.error('Error handling URL request:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
            }
        });
    }

    handleTriggerExtension(req, res) {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                console.log('Triggering browser extension...');
                
                // Send message to renderer to trigger extension
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('trigger-extension-url');
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: 'Extension triggered' 
                }));
            } catch (error) {
                console.error('Error triggering extension:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
            }
        });
    }

    handleCheckRequest(req, res) {
        try {
            // Check if we're currently requesting URL
            const isRequesting = this.isRequestingUrl || false;
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                requestUrl: isRequesting,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Error checking request:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
        }
    }

    triggerExtensionUrlDetection() {
        try {
            console.log('Triggering extension URL detection...');
            
            // Just send a message to renderer to trigger extension
            if (this.mainWindow) {
                this.mainWindow.webContents.send('trigger-extension-url');
            }
            
        } catch (error) {
            console.log('Extension trigger failed:', error.message);
        }
    }

    stopHttpServer() {
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
        }
    }
}

module.exports = HttpService;
