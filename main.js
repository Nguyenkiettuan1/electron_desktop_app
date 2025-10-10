const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell } = require('electron');
const path = require('path');

const config = require('./app.config');

// Import modules
const ApiService = require('./modules/api/apiService');
const ScreenshotService = require('./modules/screenshot/screenshotService');
const UrlService = require('./modules/url/urlService');
const HttpService = require('./modules/http/httpService');

class TestAutomationApp {
    constructor() {
        this.mainWindow = null;
        this.pythonServer = null;
        this.isDev = process.argv.includes('--dev');
        
        // Initialize services
        this.apiService = new ApiService();
        this.screenshotService = new ScreenshotService();
        this.urlService = new UrlService();
        this.httpService = new HttpService();
    }

    createWindow() {
        // Create the browser window with modern styling
        this.mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 1200,
            minHeight: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true
            },
            icon: path.join(__dirname, 'assets/icon.png'),
            titleBarStyle: 'default',
            show: false,
            frame: true,
            transparent: false,
            backgroundColor: '#f8f9fa'
        });

        // Load the app
        if (this.isDev) {
            this.mainWindow.loadFile('index.html');
            this.mainWindow.webContents.openDevTools();
        } else {
            this.mainWindow.loadFile('index.html');
        }

        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
        });

        // Handle window closed
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Register global shortcuts
        this.registerGlobalShortcuts();
        
        // Set main window reference for services
        this.httpService.setMainWindow(this.mainWindow);
        
        // Preload screenshot sources for ultra-fast capture
        this.screenshotService.preloadScreenshotSources();
    }

    registerGlobalShortcuts() {
        // Register Ctrl+Shift+Q for screenshot (faster response)
        globalShortcut.register('CommandOrControl+Shift+Q', () => {
            this.takeScreenshot();
        });

        // Register Ctrl+Shift+U for upload
        globalShortcut.register('CommandOrControl+Shift+U', () => {
            this.triggerUpload();
        });

        // Register Esc for cancel
        globalShortcut.register('Escape', () => {
            this.triggerCancel();
        });

        // Register Ctrl+Alt+U for URL detection
        globalShortcut.register('CommandOrControl+Alt+U', () => {
            this.detectUrl();
        });
    }

    async startPythonServer() {
        try {
            // Skip API server check - let the renderer handle it
            console.log('Electron app starting - API server check will be done by renderer');
            
            // Start HTTP server for browser extension communication
            this.httpService.startHttpServer();
            
        } catch (error) {
            console.error('Failed to start:', error);
        }
    }


    async stopPythonServer() {
        if (this.pythonServer) {
            this.pythonServer.kill();
            this.pythonServer = null;
        }
        
        this.httpService.stopHttpServer();
    }

    setAccessToken(token, user) {
        this.apiService.setAccessToken(token, user);
        this.screenshotService.setCurrentUser(user);
    }


    async checkUrlExists(url) {
        return await this.apiService.checkUrlExists(url);
    }




    async takeScreenshot() {
        try {
            console.log('Taking screenshot...');
            
            // Get current URL from renderer process first
            const currentUrl = await this.getCurrentUrlFromRenderer();
            
            if (!currentUrl || currentUrl.trim() === '') {
                console.log('No URL found, skipping screenshot');
                this.mainWindow.webContents.send('screenshot-failed', {
                    error: 'No URL found. Please enter or detect URL first.'
                });
                return;
            }
            
            // Check if URL already exists in database
            console.log('🔍 Checking URL existence before screenshot:', currentUrl);
            const urlCheckResult = await this.apiService.checkUrlExists(currentUrl);
            
            if (urlCheckResult.success && urlCheckResult.exists) {
                console.log('❌ URL already exists in database');
                this.mainWindow.webContents.send('url-already-exists', {
                    message: 'URL already exists in database! Please navigate to a different URL and try again.'
                });
                return;
            }
            
            console.log('✅ URL is new, proceeding with screenshot');
            
            // Hide main window temporarily
            this.mainWindow.hide();
            
            // Wait for screen to stabilize
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Set URL in screenshot service
            this.screenshotService.setCurrentUrl(currentUrl);
            
            // Capture screenshot using service
            const screenshotResult = await this.screenshotService.captureScreenshot();
            
            // Handle screenshot result
            if (screenshotResult) {
                // Send screenshot data
                this.mainWindow.webContents.send('screenshot-taken', screenshotResult);
            } else {
                console.error('Screenshot failed');
                this.mainWindow.webContents.send('screenshot-failed', {
                    error: 'Screenshot capture failed'
                });
            }
            
            // Show main window
            this.mainWindow.show();
            this.mainWindow.focus();
            
        } catch (error) {
            console.error('Screenshot failed:', error);
            this.mainWindow.show();
            this.mainWindow.focus();
            dialog.showErrorBox('Screenshot Error', 'Failed to take screenshot: ' + error.message);
        }
    }


    triggerUpload() {
        // Send message to renderer to trigger upload
        if (this.mainWindow) {
            this.mainWindow.webContents.send('trigger-upload');
        }
    }

    triggerCancel() {
        // Send message to renderer to trigger cancel
        if (this.mainWindow) {
            this.mainWindow.webContents.send('trigger-cancel');
        }
    }

    async getCurrentUrlFromRenderer() {
        try {
            // Get URL from renderer process via IPC
            const result = await this.mainWindow.webContents.executeJavaScript(`
                document.getElementById('url').value || ''
            `);
            return result || null;
        } catch (error) {
            console.error('Failed to get URL from renderer:', error);
            return null;
        }
    }

    async detectUrl() {
        try {
            console.log('Detecting URL...');
            
            // Use URL service to detect URL
            const detectedUrl = await this.urlService.detectUrl();
            
            if (detectedUrl) {
                console.log('URL detected:', detectedUrl);
                this.urlService.setCurrentUrl(detectedUrl);
                this.mainWindow.webContents.send('url-detected', detectedUrl);
            } else {
                // Ask user to copy URL manually
                this.mainWindow.webContents.send('url-detection-request', 'Please copy the URL from your browser (Ctrl+L then Ctrl+C) and try again');
            }
            
        } catch (error) {
            console.error('URL detection failed:', error);
            this.mainWindow.webContents.send('url-detection-failed', error.message);
        }
    }

}

// Create app instance
const testApp = new TestAutomationApp();

// App event handlers
app.whenReady().then(async () => {
    await testApp.startPythonServer();
    testApp.createWindow();
});

app.on('window-all-closed', async () => {
    await testApp.stopPythonServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        testApp.createWindow();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// IPC handlers
ipcMain.handle('login', async (event, credentials) => {
    return await testApp.apiService.login(credentials);
});

ipcMain.handle('get-current-user', async (event) => {
    return await testApp.apiService.getCurrentUser();
});

ipcMain.handle('get-regions', async (event, { searchQuery = '', page = 1, pageSize = 10 } = {}) => {
    return await testApp.apiService.getRegions(searchQuery, page, pageSize);
});

ipcMain.handle('get-signals', async (event, { searchQuery = '', page = 1, pageSize = 10 } = {}) => {
    return await testApp.apiService.getSignals(searchQuery, page, pageSize);
});

ipcMain.handle('get-sports', async (event, { regionId, searchQuery = '', page = 1, pageSize = 10 }) => {
    return await testApp.apiService.getSports(regionId, searchQuery, page, pageSize);
});

// New IPC handlers for screenshot workflow
ipcMain.handle('take-screenshot', async (event) => {
    try {
        await testApp.takeScreenshot();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('detect-url', async (event) => {
    try {
        await testApp.detectUrl();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-screenshot-path', async (event) => {
    return testApp.screenshotService.getScreenshotPath();
});

ipcMain.handle('get-current-url', async (event) => {
    return testApp.urlService.getCurrentUrl();
});

ipcMain.handle('get-url-from-clipboard', async (event) => {
    try {
        const url = await testApp.urlService.detectUrlFromClipboard();
        if (url) {
            return { success: true, url: url };
        } else {
            return { success: false, error: 'No URL found in clipboard' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('set-access-token', async (event, { token, user }) => {
    testApp.setAccessToken(token, user);
    return { success: true };
});

ipcMain.handle('check-url-exists', async (event, url) => {
    return await testApp.apiService.checkUrlExists(url);
});

ipcMain.handle('create-detected-link', async (event, { url, sportId, signalId, assignedUserId }) => {
    return await testApp.apiService.createDetectedLink(url, sportId, signalId, assignedUserId);
});

ipcMain.handle('upload-screenshot', async (event, { filePath, detectedLinkId, bucketName = 'screenshots', provider = 'GOOGLE_CLOUD' }) => {
    return await testApp.apiService.uploadScreenshot(filePath, detectedLinkId, bucketName, provider);
});

// Window control handlers
ipcMain.handle('minimize-window', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.minimize();
    }
});

ipcMain.handle('toggle-maximize-window', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        if (window.isMaximized()) {
            window.unmaximize();
        } else {
            window.maximize();
        }
    }
});

ipcMain.handle('close-window', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.close();
    }
});

// Config handler
ipcMain.handle('get-config', async (event) => {
    return {
        apiBaseUrl: config.apiBaseUrl,
        nodeEnv: config.nodeEnv,
        backendHost: config.backendHost,
        backendPort: config.backendPort
    };
});


// Flash window handler
ipcMain.on('flash-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        // Flash window on taskbar
        window.flashFrame(true);
        
        // Focus window
        window.focus();
        window.show();
        
        // Stop flashing after 3 seconds
        setTimeout(() => {
            window.flashFrame(false);
        }, 3000);
    }
});
