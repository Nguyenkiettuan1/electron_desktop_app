const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell, desktopCapturer, screen } = require('electron');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const http = require('http');
const url = require('url');

const config = require('./app.config');

class TestAutomationApp {
    constructor() {
        this.mainWindow = null;
        this.pythonServer = null;
        this.isDev = process.argv.includes('--dev');
        this.screenshotPath = null;
        this.currentUrl = null;
        this.httpServer = null;
        this.isRequestingUrl = false;
        this.accessToken = null;
        this.currentUser = null; // Add currentUser property
        this.apiBaseUrl = config.apiBaseUrl; 
        
        // No cache - direct API calls only
        this.preloadedSources = null;
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
        
        // Preload screenshot sources for ultra-fast capture
        this.preloadScreenshotSources();
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
            this.startHttpServer();
            
        } catch (error) {
            console.error('Failed to start:', error);
        }
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
                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString();
                    });
                    
                    req.on('end', () => {
                        try {
                            const data = JSON.parse(body);
                            console.log('URL received from browser extension:', data.url);
                            
                            // Store the URL
                            this.currentUrl = data.url;
                            this.isRequestingUrl = false;
                            
                            // Send to renderer process
                            if (this.mainWindow) {
                                this.mainWindow.webContents.send('url-detected', data.url);
                            }
                            
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        } catch (error) {
                            console.error('Error parsing URL data:', error);
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
                        }
                    });
                } else if (parsedUrl.pathname === '/api/request-url' && req.method === 'POST') {
                    // Handle request from Electron app to get current URL
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
                } else if (parsedUrl.pathname === '/api/trigger-extension' && req.method === 'POST') {
                    // Handle trigger extension request
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
                } else if (parsedUrl.pathname === '/api/check-request' && req.method === 'GET') {
                    // Handle check request from extension
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

    async stopPythonServer() {
        if (this.pythonServer) {
            this.pythonServer.kill();
            this.pythonServer = null;
        }
        
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
        }
    }

    setAccessToken(token) {
        this.accessToken = token;
    }


    async checkUrlExists(url) {
        try {
            console.log('Checking if URL exists (exact match):', url);
            
            // Skip URL check if no access token
            if (!this.accessToken) {
                console.log('No access token, skipping URL check');
                return { success: true, exists: false };
            }
            
            // Make direct API call without cache
            const response = await axios.get(`${this.apiBaseUrl}/detected_links?page_size=200`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data && response.data.data) {
                const existingUrls = response.data.data;
                console.log(`Checking against ${existingUrls.length} existing URLs`);
                
                // Check for exact match (simple string comparison)
                const exactMatch = existingUrls.some(link => {
                    return link.url === url;
                });
                
                console.log('URL exists check result (exact):', exactMatch);
                return { success: true, exists: exactMatch };
            } else {
                console.log('No data in response, assuming URL does not exist');
                return { success: true, exists: false };
            }
            
        } catch (error) {
            console.error('Error checking URL existence:', error);
            // Return false on error to allow screenshot to continue
            return { success: true, exists: false };
        }
    }


    extractDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            let domain = urlObj.hostname;
            
            // Remove www prefix
            if (domain.startsWith('www.')) {
                domain = domain.substring(4);
            }
            
            // Remove subdomain if it's a common one
            const commonSubdomains = ['m.', 'mobile.', 'app.', 'api.'];
            for (const subdomain of commonSubdomains) {
                if (domain.startsWith(subdomain)) {
                    domain = domain.substring(subdomain.length);
                    break;
                }
            }
            
            // Replace dots with underscores for filename
            return domain.replace(/\./g, '_');
        } catch (error) {
            console.error('Error extracting domain:', error);
            return 'unknown';
        }
    }


    async takeScreenshot() {
        try {
            console.log('Taking screenshot...');
            
            // Don't auto detect URL - only use manual input or extension
            console.log('Capturing screenshot without auto URL detection...');
            
            // Step 1: Capture screenshot only
            const screenshotResult = await this.captureScreenshot();
            
            // Handle screenshot result
            if (screenshotResult) {
                // Send screenshot data without URL
                this.mainWindow.webContents.send('screenshot-taken', {
                    path: this.screenshotPath,
                    filename: screenshotResult.filename,
                    timestamp: screenshotResult.timestamp
                });
            } else {
                console.error('Screenshot failed');
                this.mainWindow.webContents.send('screenshot-failed', {
                    error: 'Screenshot capture failed'
                });
            }
            
        } catch (error) {
            console.error('Screenshot failed:', error);
            this.mainWindow.show();
            this.mainWindow.focus();
            dialog.showErrorBox('Screenshot Error', 'Failed to take screenshot: ' + error.message);
        }
    }

    async preloadScreenshotSources() {
        try {
            // Preload screenshot sources for ultra-fast capture
            this.preloadedSources = await desktopCapturer.getSources({
                types: ['screen'], // Changed from 'window' to 'screen'
                thumbnailSize: { width: 1920, height: 1080 },
                fetchWindowIcons: false, // Not needed for screen
                fetchWindowBounds: false // Not needed for screen
            });
            console.log('Screenshot sources preloaded for ultra-fast capture');
        } catch (error) {
            console.log('Preload failed, will load on demand:', error.message);
        }
    }

    async captureScreenshot() {
        try {
            // Hide main window temporarily
            this.mainWindow.hide();
            
            // Wait for screen to stabilize and ensure we capture the current display
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Force focus to any visible window to ensure proper screen capture
            try {
                // This helps ensure we capture the current active screen
                const { screen } = require('electron');
                const displays = screen.getAllDisplays();
                console.log('Available displays:', displays.length);
            } catch (error) {
                console.log('Could not get display info:', error.message);
            }
            
            // Always capture fresh screen (don't use preloaded)
            console.log('📸 Capturing current screen...');
            console.log('⏱️  Wait time: 300ms for screen stabilization');
            const sources = await desktopCapturer.getSources({
                types: ['screen'], // Capture entire screen
                thumbnailSize: { width: 1920, height: 1080 },
                fetchWindowIcons: false,
                fetchWindowBounds: false
            });
            console.log('📱 Screen sources found:', sources.length);
            
            if (sources.length > 0) {
                console.log('=== AVAILABLE SCREENS ===');
                sources.forEach((source, index) => {
                    console.log(`${index}: ${source.name} (ID: ${source.id})`);
                });
                
                // Find the primary screen (usually the first one)
                let primarySource = sources[0];
                
                // If multiple screens, try to find the primary one
                if (sources.length > 1) {
                    const primaryScreen = sources.find(source => 
                        source.name.toLowerCase().includes('primary') ||
                        source.name.toLowerCase().includes('main') ||
                        source.name.toLowerCase().includes('display 1') ||
                        source.name.toLowerCase().includes('screen 1')
                    );
                    
                    if (primaryScreen) {
                        primarySource = primaryScreen;
                        console.log('Found primary screen:', primaryScreen.name);
                    } else {
                        console.log('No primary screen found, using first screen');
                    }
                }
                
                console.log('🎯 Using screen source:', primarySource.name);
                console.log('🖼️  Screenshot dimensions:', primarySource.thumbnail.getSize());
                const screenshot = primarySource.thumbnail;
                
                // Generate filename: domain_user.{extension}
                const domain = this.extractDomainFromUrl(this.currentUrl || 'unknown');
                const user = this.currentUser?.username || 'user';
                const filename = `${domain}_${user}.png`;
                
                console.log('📝 Generated filename:', filename);
                console.log('🌐 Domain:', domain);
                console.log('👤 User:', user);
                
                // Save screenshot to local project folder
                const projectDir = __dirname; // Current project directory
                const screenshotsDir = path.join(projectDir, 'screenshots');
                
                console.log('📁 Project directory:', projectDir);
                console.log('📁 Screenshots directory:', screenshotsDir);
                
                // Create screenshots directory if it doesn't exist
                if (!fs.existsSync(screenshotsDir)) {
                    console.log('📁 Creating screenshots directory...');
                    fs.mkdirSync(screenshotsDir, { recursive: true });
                    console.log('✅ Screenshots directory created');
                } else {
                    console.log('✅ Screenshots directory already exists');
                }
                
                this.screenshotPath = path.join(screenshotsDir, filename);
                console.log('💾 Full screenshot path:', this.screenshotPath);
                
                // Convert to buffer and save
                const buffer = screenshot.toPNG();
                fs.writeFileSync(this.screenshotPath, buffer);
                
                console.log('✅ Screenshot saved to:', this.screenshotPath);
                console.log('📁 Screenshots folder:', screenshotsDir);
                console.log('🖼️  Screenshot filename:', filename);
                
                // Show main window
                this.mainWindow.show();
                this.mainWindow.focus();
                
                const t_stamp = new Date().toISOString();
                
                return {
                    filename: filename, // Already generated above
                    timestamp: t_stamp
                };
                
            } else {
                console.error('No screen sources available');
                this.mainWindow.show();
                this.mainWindow.focus();
                return null;
            }
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            this.mainWindow.show();
            this.mainWindow.focus();
            return null;
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

    async detectUrl() {
        try {
            console.log('Detecting URL...');
            
            // Method 1: Try to get URL from clipboard (user can copy URL manually)
            const { clipboard } = require('electron');
            const clipboardText = clipboard.readText();
            
            if (clipboardText && (clipboardText.startsWith('http://') || clipboardText.startsWith('https://'))) {
                console.log('URL detected from clipboard:', clipboardText);
                this.currentUrl = clipboardText;
                this.mainWindow.webContents.send('url-detected', clipboardText);
                return;
            }
            
            // Method 2: Try to detect browser window and get URL using Windows API
            try {
                const url = await this.detectUrlFromBrowser();
                if (url) {
                    console.log('URL detected from browser:', url);
                    this.currentUrl = url;
                    this.mainWindow.webContents.send('url-detected', url);
                    return;
                }
            } catch (error) {
                console.log('Browser detection failed:', error.message);
            }
            
            // Method 3: Ask user to copy URL manually
            this.mainWindow.webContents.send('url-detection-request', 'Please copy the URL from your browser (Ctrl+L then Ctrl+C) and try again');
            
        } catch (error) {
            console.error('URL detection failed:', error);
            this.mainWindow.webContents.send('url-detection-failed', error.message);
        }
    }

    async detectUrlFromBrowser() {
        try {
            // Use Node.js child_process to run a simple PowerShell script
            const { exec } = require('child_process');
            
            const powershellScript = `
                Add-Type -AssemblyName System.Windows.Forms
                Add-Type -AssemblyName System.Drawing
                
                # Get active window
                $activeWindow = [System.Windows.Forms.Form]::ActiveForm
                if ($activeWindow -eq $null) {
                    # Try alternative method
                    $processes = Get-Process | Where-Object {$_.MainWindowTitle -ne ""}
                    $browserProcesses = $processes | Where-Object {
                        $_.ProcessName -match "chrome|edge|firefox|msedge" -or 
                        $_.MainWindowTitle -match "chrome|edge|firefox|microsoft"
                    }
                    
                    if ($browserProcesses) {
                        $browserProcesses[0].MainWindowTitle
                    }
                } else {
                    $activeWindow.Text
                }
            `;
            
            return new Promise((resolve, reject) => {
                exec(`powershell -Command "${powershellScript}"`, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    
                    const windowTitle = stdout.trim();
                    console.log('Active window title:', windowTitle);
                    
                    // Check if it's a browser
                    const browserIndicators = ['chrome', 'edge', 'firefox', 'microsoft'];
                    const isBrowser = browserIndicators.some(indicator => 
                        windowTitle.toLowerCase().includes(indicator)
                    );
                    
                    if (isBrowser) {
                        // Try to get URL using COM automation via PowerShell
                        this.getUrlFromBrowserViaPowerShell().then(resolve).catch(reject);
                    } else {
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('Browser detection failed:', error);
            return null;
        }
    }

    async getUrlFromBrowserViaPowerShell() {
        try {
            const { exec } = require('child_process');
            
            const powershellScript = `
                try {
                    # Try Chrome first
                    $chrome = New-Object -ComObject Chrome.Application
                    if ($chrome -and $chrome.Windows) {
                        $window = $chrome.Windows(0)
                        if ($window -and $window.ActiveTab) {
                            $url = $window.ActiveTab.Url
                            if ($url -and ($url.StartsWith("http://") -or $url.StartsWith("https://"))) {
                                Write-Output $url
                                exit 0
                            }
                        }
                    }
                } catch {
                    # Chrome failed, try Edge
                    try {
                        $edgeObjects = @("MicrosoftEdge.Application", "Edge.Application", "msedge.Application")
                        foreach ($edgeObj in $edgeObjects) {
                            try {
                                $edge = New-Object -ComObject $edgeObj
                                if ($edge -and $edge.Windows) {
                                    $window = $edge.Windows(0)
                                    if ($window -and $window.ActiveTab) {
                                        $url = $window.ActiveTab.Url
                                        if ($url -and ($url.StartsWith("http://") -or $url.StartsWith("https://"))) {
                                            Write-Output $url
                                            exit 0
                                        }
                                    }
                                }
                            } catch {
                                continue
                            }
                        }
                    } catch {
                        # All COM methods failed
                        Write-Output "NO_URL"
                    }
                }
            `;
            
            return new Promise((resolve, reject) => {
                exec(`powershell -Command "${powershellScript}"`, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    
                    const url = stdout.trim();
                    if (url && url !== 'NO_URL' && (url.startsWith('http://') || url.startsWith('https://'))) {
                        resolve(url);
                    } else {
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('PowerShell URL detection failed:', error);
            return null;
        }
    }

    async requestUrlFromExtension() {
        try {
            console.log('Requesting URL from browser extension...');
            this.isRequestingUrl = true;
            
            // Try to get URL from clipboard first (fastest method)
            const { clipboard } = require('electron');
            const clipboardText = clipboard.readText();
            
            if (clipboardText && (clipboardText.startsWith('http://') || clipboardText.startsWith('https://'))) {
                console.log('URL detected from clipboard:', clipboardText);
                this.currentUrl = clipboardText;
                this.isRequestingUrl = false;
                return clipboardText;
            }
            
            // Try PowerShell method on Windows (more reliable than extension)
            if (process.platform === 'win32') {
                try {
                    const url = await this.detectUrlFromBrowser();
                    if (url) {
                        console.log('URL detected from browser:', url);
                        this.currentUrl = url;
                        this.isRequestingUrl = false;
                        return url;
                    }
                } catch (error) {
                    console.log('Browser detection failed:', error.message);
                }
            }
            
            // Send request to browser extension to get current URL
            console.log('Sending request to browser extension...');
            try {
                const axios = require('axios');
                const response = await axios.post('http://localhost:3000/api/request-url', {
                    timestamp: new Date().toISOString()
                }, {
                    timeout: 800 // Ultra-fast timeout for maximum speed
                });
                
                console.log('Extension response:', response.data);
            } catch (error) {
                console.log('Extension not responding:', error.message);
            }
            
            // Extension will auto-send URL when tab changes
            
            // Ultra-fast wait for extension to send URL
            console.log('Waiting for browser extension to send URL...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if URL was received from extension during the wait
            if (this.currentUrl) {
                console.log('URL received from extension:', this.currentUrl);
                this.isRequestingUrl = false;
                return this.currentUrl;
            }
            
        } catch (error) {
            console.log('URL detection failed:', error.message);
        } finally {
            this.isRequestingUrl = false;
        }
        
        console.log('No URL detected automatically');
        return null;
    }

    async triggerExtensionUrlDetection() {
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
    try {
        // Use form data like Python tool does
        const formData = new URLSearchParams();
        formData.append('username', credentials.username);
        formData.append('password', credentials.password);
        
        const response = await axios.post('http://localhost:8000/api/v1/auth/login', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        });
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Login error:', error.response?.data || error.message);
        return { success: false, error: error.response?.data?.detail || error.message };
    }
});

ipcMain.handle('get-current-user', async (event) => {
    try {
        const response = await axios.get('http://localhost:8000/api/v1/auth/me', {
            headers: { 'Authorization': `Bearer ${event.sender.session.accessToken}` }
        });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-regions', async (event) => {
    try {
        const response = await axios.get('http://localhost:8000/api/v1/regions?page_size=100');
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-signals', async (event) => {
    try {
        const response = await axios.get('http://localhost:8000/api/v1/signals?page_size=100');
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-sports', async (event, regionId) => {
    try {
        const response = await axios.get(`http://localhost:8000/api/v1/sports?page_size=100&region_id=${regionId}`);
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
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
    return testApp.screenshotPath;
});

ipcMain.handle('get-current-url', async (event) => {
    return testApp.currentUrl;
});

ipcMain.handle('get-url-from-clipboard', async (event) => {
    try {
        const { clipboard } = require('electron');
        const clipboardText = clipboard.readText();
        
        if (clipboardText && (clipboardText.startsWith('http://') || clipboardText.startsWith('https://'))) {
            return { success: true, url: clipboardText };
        } else {
            return { success: false, error: 'No URL found in clipboard' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('set-access-token', async (event, { token, user }) => {
    testApp.setAccessToken(token);
    testApp.currentUser = user; // Store user info for filename generation
    return { success: true };
});

ipcMain.handle('check-url-exists', async (event, url) => {
    try {
        console.log('🔍 Checking URL existence in main process:', url);
        
        // Get all detected links and check manually
        const response = await axios.get(`${testApp.apiBaseUrl}/detected_links?page_size=200`, {
            headers: {
                'Authorization': `Bearer ${testApp.accessToken}`
            }
        });
        
        if (response.data && response.data.data) {
            const existingUrls = response.data.data;
            console.log(`🔍 Checking against ${existingUrls.length} existing URLs`);
            
            // Check for exact match
            const exactMatch = existingUrls.some(link => {
                return link.url === url;
            });
            
            console.log('🔍 URL exists check result (exact):', exactMatch);
            return { success: true, exists: exactMatch };
        } else {
            console.log('🔍 No data in response, assuming URL does not exist');
            return { success: true, exists: false };
        }
    } catch (error) {
        console.error('❌ Error checking URL existence:', error);
        // Return false on error to allow screenshot to continue
        return { success: true, exists: false };
    }
});

ipcMain.handle('create-detected-link', async (event, { url, sportId, assignedUserId }) => {
    try {
        console.log('🔗 Creating detected link in main process:', { url, sportId, assignedUserId });
        const response = await axios.post(`${testApp.apiBaseUrl}/detected_links`, {
            url: url,
            sport_id: sportId,
            assigned_user_id: assignedUserId
        }, {
            headers: {
                'Authorization': `Bearer ${testApp.accessToken}`
            }
        });
        console.log('✅ Detected link created successfully');
        return { success: true, data: response.data };
    } catch (error) {
        console.error('❌ Error creating detected link:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('upload-screenshot', async (event, { filePath, detectedLinkId, bucketName = 'screenshots' }) => {
    try {
        const FormData = require('form-data');
        const form = new FormData();
        
        // Add file
        form.append('file', fs.createReadStream(filePath));
        
        // Add other data (provider will use default GOOGLE_CLOUD from API)
        form.append('detected_link_id', detectedLinkId);
        form.append('bucket_name', bucketName);
        // Note: provider is not sent, will use default GOOGLE_CLOUD from API
        
        const response = await axios.post(`${testApp.apiBaseUrl}/detected_link_images/upload`, form, {
            headers: {
                'Authorization': `Bearer ${testApp.accessToken}`,
                ...form.getHeaders()
            }
        });
        
        return { success: true, data: response.data };
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
