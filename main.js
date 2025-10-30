const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const config = require('./app.config');

// Import modules
const ApiService = require('./modules/api/apiService');
const ScreenshotService = require('./modules/screenshot/screenshotService');
const UrlService = require('./modules/url/urlService');
const HttpService = require('./modules/http/httpService');
const SettingsService = require('./modules/settings/settingsService');

class TestAutomationApp {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
        this.isQuitting = false;
        this.pythonServer = null;
        this.isDev = process.argv.includes('--dev');
        this.currentSessionData = null; // Store session data
        
        // Initialize services
        this.apiService = new ApiService();
        this.screenshotService = new ScreenshotService();
        this.urlService = new UrlService();
        this.httpService = new HttpService();
        this.settingsService = new SettingsService();
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

        // Setup auto-updater
        this.setupAutoUpdater();

        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            
            // Check for updates on startup (after 3 seconds)
            setTimeout(() => {
                this.checkForUpdates();
            }, 3000);
        });

        // Handle window close (ask to minimize to tray or quit)
        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.showExitDialog();
            }
        });

        // Handle window closed
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Create system tray
        this.createTray();

        // Register global shortcuts
        this.registerGlobalShortcuts();
        
        // Set main window reference for services
        this.httpService.setMainWindow(this.mainWindow);
        
        // Preload screenshot sources for ultra-fast capture
        this.screenshotService.preloadScreenshotSources();
    }

    createTray() {
        try {
            console.log('🔍 Creating system tray...');
            
            // Simple: Just load icon.ico
            const iconPath = path.join(__dirname, 'assets/icon.ico');
            console.log('Loading icon from:', iconPath);
            
            const trayIcon = nativeImage.createFromPath(iconPath);
            this.tray = new Tray(trayIcon);
            
            console.log('✅ System tray created');
            
            // Create context menu
            const contextMenu = Menu.buildFromTemplate([
                {
                    label: '📱 Show App',
                    click: () => {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                    }
                },
                {
                    label: '📸 Take Screenshot',
                    click: () => {
                        this.takeScreenshot();
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: '⚙️ Settings',
                    click: () => {
                        this.mainWindow.show();
                        this.mainWindow.focus();
                        this.mainWindow.webContents.send('open-settings');
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: '❌ Quit',
                    click: () => {
                        this.isQuitting = true;
                        app.quit();
                    }
                }
            ]);
            
            this.tray.setContextMenu(contextMenu);
            this.tray.setToolTip('Test Automation Screen Auto');
            
            // Double click to show window
            this.tray.on('double-click', () => {
                this.mainWindow.show();
                this.mainWindow.focus();
            });
            
            // Single click to show menu (Windows behavior)
            this.tray.on('click', () => {
                this.tray.popUpContextMenu();
            });
            
            console.log('✅ System tray ready!');
        } catch (error) {
            console.error('❌ Failed to create system tray:', error);
        }
    }


    showExitDialog() {
        const choice = dialog.showMessageBoxSync(this.mainWindow, {
            type: 'question',
            buttons: ['Minimize to Tray', 'Exit'],
            title: 'Confirm Exit',
            message: 'Do you want to minimize to tray or exit the application?',
            defaultId: 0,
            cancelId: 0
        });

        if (choice === 0) {
            // Minimize to tray
            this.mainWindow.hide();
        } else {
            // Exit
            this.isQuitting = true;
            app.quit();
        }
    }

    setupAutoUpdater() {
        // Configure auto-updater
        autoUpdater.autoDownload = false; // Don't auto-download, ask user first
        autoUpdater.autoInstallOnAppQuit = true;

        // Update available
        autoUpdater.on('update-available', (info) => {
            console.log('🎉 Update available:', info.version);
            
            if (this.mainWindow) {
                const choice = dialog.showMessageBoxSync(this.mainWindow, {
                    type: 'info',
                    buttons: ['Download Update', 'Later'],
                    title: 'Update Available',
                    message: `A new version (${info.version}) is available!`,
                    detail: 'Would you like to download and install it now?',
                    defaultId: 0
                });

                if (choice === 0) {
                    autoUpdater.downloadUpdate();
                    this.mainWindow.webContents.send('update-downloading');
                }
            }
        });

        // No update available
        autoUpdater.on('update-not-available', (info) => {
            console.log('✅ App is up to date:', info.version);
        });

        // Download progress
        autoUpdater.on('download-progress', (progress) => {
            const percent = Math.round(progress.percent);
            console.log(`📥 Downloading update: ${percent}%`);
            
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-progress', percent);
            }
        });

        // Update downloaded
        autoUpdater.on('update-downloaded', (info) => {
            console.log('✅ Update downloaded:', info.version);
            
            if (this.mainWindow) {
                const choice = dialog.showMessageBoxSync(this.mainWindow, {
                    type: 'info',
                    buttons: ['Restart Now', 'Later'],
                    title: 'Update Ready',
                    message: 'Update has been downloaded.',
                    detail: 'The app will restart to install the update. Restart now?',
                    defaultId: 0
                });

                if (choice === 0) {
                    this.isQuitting = true;
                    autoUpdater.quitAndInstall(false, true);
                }
            }
        });

        // Error
        autoUpdater.on('error', (error) => {
            console.error('❌ Auto-updater error:', error);
        });
    }

    async checkForUpdates() {
        try {
            const settings = this.settingsService.getAllSettings();
            
            if (!settings.checkUpdatesOnStartup) {
                console.log('⏭️ Auto-update check disabled in settings');
                return;
            }

            console.log('🔍 Checking for updates...');
            
            // Send notification to renderer
            if (this.mainWindow) {
                this.mainWindow.webContents.send('update-check-start');
            }
            
            // Check for updates
            await autoUpdater.checkForUpdates();
            
        } catch (error) {
            console.error('❌ Update check failed:', error);
        }
    }

    registerGlobalShortcuts() {
        // Unregister all existing shortcuts first
        globalShortcut.unregisterAll();

        // Get shortcuts from settings
        const shortcuts = this.settingsService.getShortcuts();

        // Register shortcuts from settings
        if (shortcuts.takeScreenshot && shortcuts.takeScreenshot !== 'None') {
            try {
                globalShortcut.register(shortcuts.takeScreenshot, () => {
                    console.log(`Shortcut triggered: ${shortcuts.takeScreenshot}`);
                    this.takeScreenshot();
                });
            } catch (error) {
                console.error(`Failed to register shortcut ${shortcuts.takeScreenshot}:`, error);
            }
        }

        if (shortcuts.uploadScreenshot && shortcuts.uploadScreenshot !== 'None') {
            try {
                globalShortcut.register(shortcuts.uploadScreenshot, () => {
                    console.log(`Shortcut triggered: ${shortcuts.uploadScreenshot}`);
                    this.triggerUpload();
                });
            } catch (error) {
                console.error(`Failed to register shortcut ${shortcuts.uploadScreenshot}:`, error);
            }
        }

        if (shortcuts.cancelAction && shortcuts.cancelAction !== 'None') {
            try {
                globalShortcut.register(shortcuts.cancelAction, () => {
                    console.log(`Shortcut triggered: ${shortcuts.cancelAction}`);
                    this.triggerCancel();
                    // Also send event to close error popup if exists
                    if (this.mainWindow) {
                        this.mainWindow.webContents.send('close-error-popup');
                    }
                });
            } catch (error) {
                console.error(`Failed to register shortcut ${shortcuts.cancelAction}:`, error);
            }
        }

        // Register Ctrl+Alt+U for URL detection (fixed shortcut)
        try {
            globalShortcut.register('CommandOrControl+Alt+U', () => {
                this.detectUrl();
            });
        } catch (error) {
            console.error('Failed to register URL detection shortcut:', error);
        }

        console.log('Global shortcuts registered from settings:', shortcuts);
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


    async checkUrlExists(url, sportId) {
        return await this.apiService.checkUrlExists(url, sportId);
    }

    setCurrentSessionData(sessionData) {
        this.currentSessionData = sessionData;
        console.log('✅ Session data updated in main process:', sessionData);
    }

    getCurrentSessionData() {
        return this.currentSessionData;
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
            
            // Get current session data to check URL with sport context
            const sessionData = this.getCurrentSessionData();
            const sportId = sessionData?.sportId;
            
            // Check if URL already exists in database (with sport context)
            console.log('🔍 Checking URL existence before screenshot:', { url: currentUrl, sportId });
            const urlCheckResult = await this.apiService.checkUrlExists(currentUrl, sportId);
            
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

ipcMain.handle('check-url-exists', async (event, { url, sportId }) => {
    return await testApp.apiService.checkUrlExists(url, sportId);
});

ipcMain.handle('create-detected-link', async (event, { url, sportId, signalId, assignedUserId }) => {
    return await testApp.apiService.createDetectedLink(url, sportId, signalId, assignedUserId);
});

ipcMain.handle('upload-screenshot', async (event, { filePath, detectedLinkId, bucketName = 'screenshots', provider = 'GOOGLE_CLOUD' }) => {
    return await testApp.apiService.uploadScreenshot(filePath, detectedLinkId, bucketName, provider);
});

ipcMain.handle('create-signal', async (event, signalData) => {
    return await testApp.apiService.createSignal(signalData);
});

// Settings handlers
ipcMain.handle('get-settings', async (event) => {
    return testApp.settingsService.getAllSettings();
});

ipcMain.handle('get-shortcuts', async (event) => {
    return testApp.settingsService.getShortcuts();
});

ipcMain.handle('get-session-data', async (event) => {
    return testApp.getCurrentSessionData();
});

ipcMain.handle('set-session-data', async (event, sessionData) => {
    testApp.setCurrentSessionData(sessionData);
    return { success: true };
});

ipcMain.handle('save-settings', async (event, settings) => {
    try {
        // Save shortcuts
        if (settings.shortcuts) {
            testApp.settingsService.setShortcuts(settings.shortcuts);
        }
        
        // Save other settings
        if (settings.autoMinimizeAfterUpload !== undefined) {
            testApp.settingsService.setSetting('autoMinimizeAfterUpload', settings.autoMinimizeAfterUpload);
        }
        
        if (settings.notificationDuration !== undefined) {
            testApp.settingsService.setSetting('notificationDuration', settings.notificationDuration);
        }
        
        if (settings.checkUpdatesOnStartup !== undefined) {
            testApp.settingsService.setSetting('checkUpdatesOnStartup', settings.checkUpdatesOnStartup);
        }
        
        // Re-register global shortcuts with new settings
        testApp.registerGlobalShortcuts();
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('reset-settings', async (event) => {
    try {
        testApp.settingsService.resetAll();
        testApp.registerGlobalShortcuts();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Window control handlers
ipcMain.handle('minimize-window', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.minimize();
    }
});

ipcMain.handle('minimize-to-tray', async (event) => {
    if (testApp.mainWindow) {
        testApp.mainWindow.hide();
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

// Delete file handler
ipcMain.handle('delete-file', async (event, filePath) => {
    try {
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('File deleted successfully:', filePath);
            return { success: true };
        } else {
            console.log('File does not exist:', filePath);
            return { success: true }; // File already doesn't exist
        }
    } catch (error) {
        console.error('Failed to delete file:', error);
        return { success: false, error: error.message };
    }
});

// Open folder handler
ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
        const { shell } = require('electron');
        await shell.showItemInFolder(folderPath);
        console.log('Folder opened successfully:', folderPath);
        return { success: true };
    } catch (error) {
        console.error('Failed to open folder:', error);
        return { success: false, error: error.message };
    }
});

// Open file handler
ipcMain.handle('open-file', async (event, filePath) => {
    try {
        const { shell } = require('electron');
        await shell.openPath(filePath);
        console.log('File opened successfully:', filePath);
        return { success: true };
    } catch (error) {
        console.error('Failed to open file:', error);
        return { success: false, error: error.message };
    }
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
