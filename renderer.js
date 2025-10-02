// Modern JavaScript for Electron Desktop App
const { ipcRenderer } = require('electron');
const config = require('./app.config');

class TestAutomationDesktopApp {
    constructor() {
        this.currentUser = null;
        this.currentSession = null;
        this.screenshotData = null;
        this.signals = [];
        this.apiBaseUrl = 'http://127.0.0.1:8000/api/v1'; // Read from environment
        this.init();
    }

    async init() {
        await this.loadEnvironment();
        this.bindEvents();
        this.setupWindowControls();
        this.checkConnection();
    }

    async loadEnvironment() {
        try {
            // Get config from main process
            const config = await ipcRenderer.invoke('get-config');
            this.apiBaseUrl = config.apiBaseUrl;
            console.log('🔧 Loaded config from main process:', config);
            console.log('🌐 API Base URL:', this.apiBaseUrl);
        } catch (error) {
            console.error('❌ Failed to load config from main process:', error);
            // Keep default API URL
            console.log('🌐 Using default API Base URL:', this.apiBaseUrl);
        }
    }

    bindEvents() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Start session
        document.getElementById('start-session-btn').addEventListener('click', () => {
            this.startSession();
        });

        // Stop session
        document.getElementById('stop-session-btn').addEventListener('click', () => {
            this.stopSession();
        });

        // Take screenshot
        document.getElementById('take-screenshot-btn').addEventListener('click', () => {
            this.takeScreenshot();
        });

        // Detect URL
        document.getElementById('detect-url-btn').addEventListener('click', () => {
            this.detectUrl();
        });

        // Detect URL from clipboard
        document.getElementById('detect-clipboard-btn').addEventListener('click', () => {
            this.detectUrlFromClipboard();
        });

        // Single input functionality for all dropdowns (setup only, no data loading)
        this.setupSingleInputHandlers('region', 'regions', 'region_name', this.loadRegions.bind(this));
        this.setupSingleInputHandlers('sport', 'sports', 'league', this.loadSports.bind(this));
        this.setupSingleInputHandlers('signal', 'signals', 'signal_name', this.loadSignals.bind(this));
        
        // Popup signal (same logic as main signal)
        this.setupSingleInputHandlers('popup-signal', 'signals', 'signal_name', this.loadPopupSignals.bind(this));

        // Global keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Upload queue system - ENABLED (background processing)
        this.uploadQueue = [];
        this.setupUploadQueue();

        // Upload screenshot
        document.getElementById('upload-btn').addEventListener('click', () => {
            this.uploadScreenshot();
        });

        // Cancel screenshot
        document.getElementById('cancel-btn').addEventListener('click', () => {
            this.cancelScreenshot();
        });

        // Screenshot preview actions
        document.getElementById('confirm-upload-btn').addEventListener('click', () => {
            this.confirmUpload();
        });

        document.getElementById('cancel-upload-btn').addEventListener('click', () => {
            this.cancelUpload();
        });

        // Popup actions
        document.getElementById('popup-ok-btn').addEventListener('click', () => {
            this.handlePopupOk();
        });

        document.getElementById('popup-cancel-btn').addEventListener('click', () => {
            this.handlePopupCancel();
        });

        document.getElementById('popup-close-btn').addEventListener('click', () => {
            this.handlePopupCancel();
        });

        // IPC events from main process (optimized for speed)
        ipcRenderer.on('screenshot-taken', (event, data) => {
            this.handleScreenshotTaken(data);
        });

        ipcRenderer.on('screenshot-failed', (event, data) => {
            this.showNotification('Screenshot failed: ' + data.error, 'error');
            this.hideLoading();
        });

        ipcRenderer.on('url-detected', (event, url) => {
            this.handleUrlDetected(url);
        });

        ipcRenderer.on('url-detection-failed', (event, error) => {
            this.showNotification('URL detection failed: ' + error, 'error');
        });

        ipcRenderer.on('url-detection-request', (event, message) => {
            this.showNotification(message, 'info');
        });

        ipcRenderer.on('trigger-extension-url', (event) => {
            this.triggerExtensionUrlDetection();
        });

        // Hotkey triggers
        ipcRenderer.on('trigger-upload', (event) => {
            this.uploadScreenshot();
        });

        ipcRenderer.on('trigger-cancel', (event) => {
            this.cancelScreenshot();
        });
    }

    setupWindowControls() {
        // Window control buttons
        document.getElementById('minimize-btn').addEventListener('click', () => {
            ipcRenderer.invoke('minimize-window');
        });

        document.getElementById('maximize-btn').addEventListener('click', () => {
            ipcRenderer.invoke('toggle-maximize-window');
        });

        document.getElementById('close-btn').addEventListener('click', () => {
            ipcRenderer.invoke('close-window');
        });
    }




    updateSelection(items, selectedIndex) {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedIndex);
        });
    }



    setupSingleInputHandlers(inputId, apiEndpoint, searchParam, loadFunction) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(`${inputId}-dropdown`);
        const optionsContainer = document.getElementById(`${inputId}-options`);
        
        // Track state
        let currentPage = 1;
        let isLoading = false;
        let hasMoreData = true;
        let currentQuery = '';
        let selectedIndex = -1;
        let currentRegionId = null;
        
        // DON'T load initial data here - wait for user interaction
        
        // Input focus - show dropdown and load data if needed
        input.addEventListener('focus', async () => {
            console.log(`Focus on ${inputId}, children:`, optionsContainer.children.length);
            
            // Load initial data on first focus
            if (optionsContainer.children.length === 0) {
                if (inputId === 'sport') {
                    // For sports, wait for region selection
                    console.log('Sport input focused but no region selected yet');
                    return;
                } else {
                    console.log(`Loading initial data for ${inputId}`);
                    await loadFunction(1, '', true);
                }
            }
            
            // Always show dropdown when focused
            console.log(`Showing dropdown for ${inputId}`);
            dropdown.classList.remove('hidden');
        });
        
        // Input typing - search
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            currentQuery = query;
            currentPage = 1;
            hasMoreData = true;
            selectedIndex = -1;
            
            if (query.length >= 2) {
                dropdown.classList.remove('hidden');
                if (inputId === 'sport' && currentRegionId) {
                    loadFunction(currentRegionId, 1, query, true);
                } else {
                    loadFunction(1, query, true);
                }
            } else if (query.length === 0) {
                if (inputId === 'sport' && currentRegionId) {
                    loadFunction(currentRegionId, 1, '', true);
                } else {
                    loadFunction(1, '', true);
                }
            } else {
                dropdown.classList.add('hidden');
            }
        });
        
        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            const options = optionsContainer.querySelectorAll(`.${inputId}-option`);
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
                this.updateSelection(options, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                this.updateSelection(options, selectedIndex);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && options[selectedIndex]) {
                    this.selectOption(options[selectedIndex], inputId);
                }
            } else if (e.key === 'Escape') {
                dropdown.classList.add('hidden');
                selectedIndex = -1;
            }
        });
        
        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        
        // Infinite scroll on dropdown
        dropdown.addEventListener('scroll', () => {
            const scrollTop = dropdown.scrollTop;
            const scrollHeight = dropdown.scrollHeight;
            const clientHeight = dropdown.clientHeight;
            
            // Trigger when scrolled to 80%
            if (scrollTop + clientHeight >= scrollHeight * 0.8 && !isLoading && hasMoreData) {
                loadMoreData();
            }
        });
        
        async function loadMoreData() {
            if (isLoading || !hasMoreData) return;
            
            isLoading = true;
            currentPage++;
            
            try {
                if (inputId === 'sport' && currentRegionId) {
                    await loadFunction(currentRegionId, currentPage, currentQuery, false);
                } else {
                    await loadFunction(currentPage, currentQuery, false);
                }
            } catch (error) {
                console.error(`Error loading more ${inputId}:`, error);
                currentPage--;
            } finally {
                isLoading = false;
            }
        }
        
        // Special handling for sports - track region changes
        if (inputId === 'sport') {
            const regionInput = document.getElementById('region');
            regionInput.addEventListener('change', (e) => {
                // Get region ID from dataset, not input value
                currentRegionId = e.target.dataset.value;
                currentPage = 1;
                hasMoreData = true;
                currentQuery = '';
                
                if (currentRegionId) {
                    loadFunction(currentRegionId, 1, '', true);
                } else {
                    optionsContainer.innerHTML = '';
                }
            });
        }
    }

    updateSelection(options, selectedIndex) {
        options.forEach((option, index) => {
            option.classList.toggle('selected', index === selectedIndex);
        });
    }

    selectOption(option, inputId) {
        const value = option.dataset.value;
        const text = option.textContent;
        const input = document.getElementById(inputId);
        
        // Set the selected value and store the ID
        input.value = text;
        input.dataset.value = value;
        
        // Hide dropdown
        document.getElementById(`${inputId}-dropdown`).classList.add('hidden');
        
        // Show success
        this.showNotification(`${inputId} selected: ${text}`, 'success');
        
        // Special handling for region -> load sports
        if (inputId === 'region') {
            this.loadSports(value, 1, '', true);
        }
    }

    setupDropdownInfiniteScroll(dropdownId, apiEndpoint, searchParam, loadFunction) {
        const dropdown = document.getElementById(dropdownId);
        const searchInput = document.getElementById(`${dropdownId}-search`);
        
        // Track pagination state
        let currentPage = 1;
        let isLoading = false;
        let hasMoreData = true;
        let currentQuery = '';
        let currentRegionId = null;
        
        // Load initial data
        if (dropdownId === 'sport') {
            // For sports, wait for region selection
            return;
        } else {
            loadFunction(1, '', true);
        }
        
        // Search input handler
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            currentQuery = query;
            currentPage = 1;
            hasMoreData = true;
            
            // Clear dropdown
            dropdown.innerHTML = '<option value="">Select...</option>';
            
            if (query.length >= 2) {
                if (dropdownId === 'sport' && currentRegionId) {
                    loadFunction(currentRegionId, 1, query, true);
                } else {
                    loadFunction(1, query, true);
                }
            } else if (query.length === 0) {
                if (dropdownId === 'sport' && currentRegionId) {
                    loadFunction(currentRegionId, 1, '', true);
                } else {
                    loadFunction(1, '', true);
                }
            }
        });
        
        // Infinite scroll on dropdown
        dropdown.addEventListener('scroll', () => {
            const scrollTop = dropdown.scrollTop;
            const scrollHeight = dropdown.scrollHeight;
            const clientHeight = dropdown.clientHeight;
            
            // Trigger when scrolled to 80% (item 8/10)
            if (scrollTop + clientHeight >= scrollHeight * 0.8 && !isLoading && hasMoreData) {
                loadMoreData();
            }
        });
        
        async function loadMoreData() {
            if (isLoading || !hasMoreData) return;
            
            isLoading = true;
            currentPage++;
            
            try {
                if (dropdownId === 'sport' && currentRegionId) {
                    await loadFunction(currentRegionId, currentPage, currentQuery, false);
                } else {
                    await loadFunction(currentPage, currentQuery, false);
                }
            } catch (error) {
                console.error(`Error loading more ${dropdownId}:`, error);
                currentPage--; // Revert page on error
            } finally {
                isLoading = false;
            }
        }
        
        // Special handling for sports - track region changes
        if (dropdownId === 'sport') {
            const regionSelect = document.getElementById('region');
            regionSelect.addEventListener('change', (e) => {
                currentRegionId = e.target.value;
                currentPage = 1;
                hasMoreData = true;
                currentQuery = '';
                
                if (currentRegionId) {
                    loadFunction(currentRegionId, 1, '', true);
                } else {
                    dropdown.innerHTML = '<option value="">Select Sport...</option>';
                }
            });
        }
    }

    async checkConnection() {
        try {
            // Check if Python hybrid server is running
            const response = await this.apiCall('GET', '/status');
            if (response.user) {
                this.showMainInterface(response.user);
            }
        } catch (error) {
            console.log('Python hybrid server not running or not logged in');
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const loginButton = document.querySelector('#login-form button');
        const usernameGroup = document.querySelector('#username').closest('.form-group');
        const passwordGroup = document.querySelector('#password').closest('.form-group');

        // Clear previous states
        usernameGroup.classList.remove('error', 'success');
        passwordGroup.classList.remove('error', 'success');

        if (!username || !password) {
            this.showNotification('Please enter username and password', 'error');
            if (!username) {
                usernameGroup.classList.add('error');
                document.getElementById('username').focus();
            }
            if (!password) {
                passwordGroup.classList.add('error');
                document.getElementById('password').focus();
            }
            return;
        }

        try {
            // Add loading state to button
            loginButton.classList.add('loading');
            loginButton.textContent = 'Logging in...';
            loginButton.disabled = true;
            
            this.showLoading('Logging in...');
            
            // Use form data for OAuth2PasswordRequestForm
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            // Store access token
            this.accessToken = result.access_token;
            
            // Get user info first
            const userResponse = await fetch(`${this.apiBaseUrl}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (userResponse.ok) {
                const userData = await userResponse.json();
                this.currentUser = userData;
                
                // Set access token and user info in main process
                await ipcRenderer.invoke('set-access-token', { 
                    token: this.accessToken, 
                    user: userData 
                });
                
                // Add success states
                usernameGroup.classList.add('success');
                passwordGroup.classList.add('success');
                
                // Show success animation
                setTimeout(() => {
                    this.showMainInterface(userData);
                    this.showNotification('Login successful!', 'success');
                }, 500);
            } else {
                throw new Error('Failed to get user info');
            }
        } catch (error) {
            // Add error states
            usernameGroup.classList.add('error');
            passwordGroup.classList.add('error');
            this.showNotification('Login failed: ' + error.message, 'error');
        } finally {
            // Reset button state
            loginButton.classList.remove('loading');
            loginButton.textContent = 'Login';
            loginButton.disabled = false;
            this.hideLoading();
        }
    }

    handleLogout() {
        // Reset all data
        this.currentUser = null;
        this.currentSession = null;
        this.screenshotData = null;
        this.accessToken = null;
        
        // Clear upload queue
        this.clearUploadQueue();
        
        // Reset UI elements
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('main-interface').classList.add('hidden');
        
        // Reset form fields
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('region').value = '';
        document.getElementById('sport').value = '';
        document.getElementById('signal').value = '';
        document.getElementById('url').value = '';
        document.getElementById('bucket-name').value = '';
        
        // Reset input fields
        document.getElementById('region').value = '';
        document.getElementById('sport').value = '';
        document.getElementById('signal').value = '';
        
        // Clear dataset values
        document.getElementById('region').dataset.value = '';
        document.getElementById('sport').dataset.value = '';
        document.getElementById('signal').dataset.value = '';
        
        // Hide dropdowns
        document.getElementById('region-dropdown').classList.add('hidden');
        document.getElementById('sport-dropdown').classList.add('hidden');
        document.getElementById('signal-dropdown').classList.add('hidden');
        
        // Reset form states
        document.getElementById('region').disabled = false;
        document.getElementById('sport').disabled = false;
        document.getElementById('start-session-btn').disabled = false;
        document.getElementById('stop-session-btn').classList.add('hidden');
        
        // Reset session status
        this.updateSessionStatus('Not Started');
        
        // Hide any popups
        this.hideScreenshotPreview();
        this.hideScreenshotPopup();
        
        this.showNotification('Logged out successfully', 'info');
    }

    showMainInterface(user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('main-interface').classList.remove('hidden');
        document.getElementById('user-name').textContent = user.username;
        this.loadData();
    }

    async loadData() {
        try {
            this.showLoading('Loading data...');
            
            // Don't load data immediately - let user interact first
            // Data will be loaded when user focuses on inputs
            
            this.showNotification('Ready to use - click on any field to load data', 'success');
        } catch (error) {
            this.showNotification('Failed to initialize: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadRegions(page = 1, query = '', isNewSearch = true) {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: '10'
            });
            
            if (query) {
                params.append('region_name', query);
            }
            
            const response = await this.apiCallWithAuth('GET', `/regions?${params}`);
            const optionsContainer = document.getElementById('region-options');
            
            // Clear dropdown only for new search
            if (isNewSearch) {
                optionsContainer.innerHTML = '';
            }
            
            if (response.data && response.data.length > 0) {
                console.log('Loading regions:', response.data);
                response.data.forEach(region => {
                    const option = document.createElement('div');
                    option.className = 'region-option';
                    option.dataset.value = region.id;
                    option.textContent = region.region_name;
                    
                    option.addEventListener('click', () => {
                        this.selectOption(option, 'region');
                    });
                    
                    optionsContainer.appendChild(option);
                });
                
                // Show dropdown after populating
                document.getElementById('region-dropdown').classList.remove('hidden');
                
                // Check if there's more data
                if (response.data.length < 10) {
                    this.hasMoreRegions = false;
                }
            } else if (isNewSearch) {
                optionsContainer.innerHTML = '<div class="region-loading">No regions found</div>';
            }
        } catch (error) {
            console.error('Error loading regions:', error);
            if (isNewSearch) {
                this.showNotification('Error loading regions', 'error');
            }
        }
    }

    async loadSignals(page = 1, query = '', isNewSearch = true) {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: '10'
            });
            
            if (query) {
                params.append('signal_name', query);
            }
            
            const response = await this.apiCallWithAuth('GET', `/signals?${params}`);
            const optionsContainer = document.getElementById('signal-options');
            
            // Clear dropdown only for new search
            if (isNewSearch) {
                optionsContainer.innerHTML = '';
            }
            
            if (response.data && response.data.length > 0) {
                console.log('Loading signals:', response.data);
                response.data.forEach(signal => {
                    const option = document.createElement('div');
                    option.className = 'signal-option';
                    option.dataset.value = signal.id;
                    option.textContent = signal.signal_name;
                    
                    option.addEventListener('click', () => {
                        this.selectOption(option, 'signal');
                    });
                    
                    optionsContainer.appendChild(option);
                });
                
                // Show dropdown after populating
                document.getElementById('signal-dropdown').classList.remove('hidden');
                
                // Check if there's more data
                if (response.data.length < 10) {
                    this.hasMoreSignals = false;
                }
            } else if (isNewSearch) {
                optionsContainer.innerHTML = '<div class="signal-loading">No signals found</div>';
            }
        } catch (error) {
            console.error('Error loading signals:', error);
            if (isNewSearch) {
                this.showNotification('Error loading signals', 'error');
            }
        }
    }

    async loadSports(regionId, page = 1, query = '', isNewSearch = true) {
        try {
            if (isNewSearch) {
            this.showLoading('Loading sports...');
            }
            
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: '10'
            });
            
            if (regionId) {
                params.append('region_id', regionId);
            }
            
            if (query) {
                params.append('league', query);
            }
            
            const sportsResponse = await this.apiCallWithAuth('GET', `/sports?${params}`);
            const optionsContainer = document.getElementById('sport-options');
            
            // Clear dropdown only for new search
            if (isNewSearch) {
                optionsContainer.innerHTML = '';
            }
            
            if (sportsResponse.data && sportsResponse.data.length > 0) {
                console.log('Loading sports:', sportsResponse.data);
            sportsResponse.data.forEach(sport => {
                    const option = document.createElement('div');
                    option.className = 'sport-option';
                    option.dataset.value = sport.id;
                    option.textContent = `${sport.league} - ${sport.match_name}`;
                    
                    option.addEventListener('click', () => {
                        this.selectOption(option, 'sport');
                    });
                    
                    optionsContainer.appendChild(option);
                });
                
                // Show dropdown after populating
                document.getElementById('sport-dropdown').classList.remove('hidden');
                
                // Check if there's more data
                if (sportsResponse.data.length < 10) {
                    this.hasMoreSports = false;
                }
            } else if (isNewSearch) {
                optionsContainer.innerHTML = '<div class="sport-loading">No sports found</div>';
            }
            
            if (isNewSearch) {
            this.showNotification('Sports loaded successfully', 'success');
            }
        } catch (error) {
            if (isNewSearch) {
            this.showNotification('Failed to load sports: ' + error.message, 'error');
            }
        } finally {
            if (isNewSearch) {
            this.hideLoading();
            }
        }
    }

    async loadPopupSignals(page = 1, query = '', isNewSearch = true) {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: '10'
            });
            
            if (query) {
                params.append('signal_name', query);
            }
            
            const response = await this.apiCallWithAuth('GET', `/signals?${params}`);
            const optionsContainer = document.getElementById('popup-signal-options');
            
            // Clear dropdown only for new search
            if (isNewSearch) {
                optionsContainer.innerHTML = '';
            }
            
            if (response.data && response.data.length > 0) {
                console.log('Loading popup signals:', response.data);
                response.data.forEach(signal => {
                    const option = document.createElement('div');
                    option.className = 'popup-signal-option';
                    option.dataset.value = signal.id;
                    option.textContent = signal.signal_name;
                    
                    option.addEventListener('click', () => {
                        this.selectPopupSignal(option);
                    });
                    
                    optionsContainer.appendChild(option);
                });
                
                // Show dropdown after populating
                document.getElementById('popup-signal-dropdown').classList.remove('hidden');
                
                // Check if there's more data
                if (response.data.length < 10) {
                    this.hasMorePopupSignals = false;
                }
            } else if (isNewSearch) {
                optionsContainer.innerHTML = '<div class="popup-signal-loading">No signals found</div>';
            }
        } catch (error) {
            console.error('Error loading popup signals:', error);
            if (isNewSearch) {
                this.showNotification('Error loading signals', 'error');
            }
        }
    }

    selectPopupSignal(option) {
        const value = option.dataset.value;
        const text = option.textContent;
        const input = document.getElementById('popup-signal');
        
        // Set the selected value and store the ID
        input.value = text;
        input.dataset.value = value;
        
        // Hide dropdown
        document.getElementById('popup-signal-dropdown').classList.add('hidden');
        
        // Show success
        this.showNotification(`Signal selected: ${text}`, 'success');
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Check if popup is visible
            const popup = document.getElementById('screenshot-popup');
            const isPopupVisible = !popup.classList.contains('hidden');
            
            if (isPopupVisible) {
                // Ctrl+Shift+U = Upload Screenshot
                if (e.ctrlKey && e.shiftKey && e.key === 'U') {
                    e.preventDefault();
                    console.log('Ctrl+Shift+U pressed - Uploading screenshot');
                    this.uploadScreenshot();
                }
                
                // Escape = Cancel
                if (e.key === 'Escape') {
                    e.preventDefault();
                    console.log('Escape pressed - Canceling screenshot');
                    this.cancelScreenshot();
                }
            }
        });
    }

    setupUploadQueue() {
        // Queue toggle functionality
        const queueToggle = document.getElementById('queue-toggle');
        const queueContent = document.getElementById('queue-content');
        
        if (queueToggle && queueContent) {
            queueToggle.addEventListener('click', () => {
                const isCollapsed = queueContent.style.display === 'none';
                queueContent.style.display = isCollapsed ? 'block' : 'none';
                queueToggle.textContent = isCollapsed ? '−' : '+';
            });
        }
    }

    addToUploadQueue(signalId, url, bucketName, signalName = '') {
        // Check if session is still valid before adding to queue
        if (!this.currentSession || !this.currentUser) {
            this.showNotification('Session expired. Please restart the app.', 'error');
            return null;
        }
        
        // Check if screenshot data is available
        if (!this.screenshotData || !this.screenshotData.path) {
            this.showNotification('No screenshot available for upload', 'error');
            return null;
        }
        
        const queueItem = {
            id: Date.now(),
            signalId,
            url,
            bucketName,
            signalName,
            // API call parameters
            sportId: this.currentSession.sportId,
            assignedUserId: this.currentUser.id,
            filePath: this.screenshotData.path,
            status: 'uploading',
            timestamp: new Date(),
            error: null,
            imageUrl: null
        };
        
        this.uploadQueue.unshift(queueItem); // Add to beginning
        this.updateQueueDisplay();
        this.showQueue();
        
        // Start background upload
        this.uploadScreenshotBackground(queueItem);
        
        return queueItem.id;
    }

    updateQueueDisplay() {
        const queueItems = document.getElementById('queue-items');
        queueItems.innerHTML = '';
        
        this.uploadQueue.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'queue-item';
            itemEl.dataset.itemId = item.id;
            
            const statusClass = item.status === 'uploading' ? 'uploading' : 
                              item.status === 'success' ? 'success' : 'error';
            
            itemEl.innerHTML = `
                <div class="queue-item-status ${statusClass}"></div>
                <div class="queue-item-info">
                    <div class="queue-item-url">${item.url}</div>
                    ${item.imageUrl ? `<div class="queue-item-image-url">📷 ${item.imageUrl}</div>` : ''}
                    <div class="queue-item-time">${item.timestamp.toLocaleTimeString()}</div>
                </div>
                <div class="queue-item-actions">
                    ${item.status === 'error' ? '<button class="queue-item-action" title="View Error">⚠️</button>' : ''}
                    ${item.status === 'success' ? '<button class="queue-item-action" title="View Image">🔗</button>' : ''}
                    <button class="queue-item-action" title="Remove">🗑️</button>
                </div>
            `;
            
            // Add click handlers
            itemEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('queue-item-action')) {
                    e.stopPropagation();
                    return;
                }
                
                if (item.status === 'error') {
                    this.showErrorDetails(item);
                } else if (item.status === 'success') {
                    this.showImageUrl(item);
                }
            });
            
            // Action button handlers
            const errorBtn = itemEl.querySelector('[title="View Error"]');
            const imageBtn = itemEl.querySelector('[title="View Image"]');
            const removeBtn = itemEl.querySelector('[title="Remove"]');
            
            if (errorBtn) {
                errorBtn.addEventListener('click', () => this.showErrorDetails(item));
            }
            if (imageBtn) {
                imageBtn.addEventListener('click', () => this.showImageUrl(item));
            }
            if (removeBtn) {
                removeBtn.addEventListener('click', () => this.removeFromQueue(item.id));
            }
            
            queueItems.appendChild(itemEl);
        });
    }

    showQueue() {
        const queue = document.getElementById('upload-queue');
        queue.classList.remove('hidden');
    }

    hideQueue() {
        const queue = document.getElementById('upload-queue');
        queue.classList.add('hidden');
    }

    removeFromQueue(itemId) {
        this.uploadQueue = this.uploadQueue.filter(item => item.id !== itemId);
        this.updateQueueDisplay();
        
        if (this.uploadQueue.length === 0) {
            this.hideQueue();
        }
    }

    clearUploadQueue() {
        this.uploadQueue = [];
        this.updateQueueDisplay();
        this.hideQueue();
        console.log('Upload queue cleared');
    }

    showErrorDetails(item) {
        const errorMsg = item.error || 'Unknown error occurred';
        this.showNotification(`Upload failed: ${errorMsg}`, 'error');
        
        // Copy error URL to clipboard if available
        if (item.url) {
            navigator.clipboard.writeText(item.url);
            this.showNotification('Error URL copied to clipboard', 'info');
        }
    }

    showImageUrl(item) {
        if (item.imageUrl) {
            navigator.clipboard.writeText(item.imageUrl);
            this.showNotification('Image URL copied to clipboard', 'success');
        }
    }

    showErrorPopupWithDetails(queueItem) {
        // Create error popup with URL and details
        const popup = document.createElement('div');
        popup.className = 'error-popup-fullscreen';
        popup.innerHTML = `
            <div class="error-popup-content-fullscreen">
                <div class="error-popup-header-fullscreen">
                    <span class="error-icon-fullscreen">❌</span>
                    <h2>Upload Failed!</h2>
                </div>
                <div class="error-popup-body-fullscreen">
                    <p class="error-message">${queueItem.error}</p>
                    <div class="error-details">
                        <p>🔗 <strong>Failed URL:</strong></p>
                        <p class="error-url">${queueItem.url}</p>
                        <p>📁 <strong>Bucket:</strong> ${queueItem.bucketName}</p>
                        <p>⏰ <strong>Time:</strong> ${queueItem.timestamp.toLocaleString()}</p>
                        <p>📝 <strong>What to do?</strong></p>
                        <p>Check your internet connection and try again, or contact support if the problem persists.</p>
                    </div>
                </div>
                <div class="error-popup-footer-fullscreen">
                    <button class="error-popup-btn-fullscreen" onclick="this.closest('.error-popup-fullscreen').remove()">
                        Got it! I'll try again
                    </button>
                    <button class="error-popup-btn-fullscreen error-copy-url" onclick="navigator.clipboard.writeText('${queueItem.url}'); this.textContent='URL Copied!'">
                        Copy URL
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Auto remove after 15 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
        }, 15000);
    }

    async startSession() {
        const regionInput = document.getElementById('region');
        const sportInput = document.getElementById('sport');
        
        // Get values from input fields (we need to track the actual IDs)
        const regionId = regionInput.dataset.value || regionInput.value;
        const sportId = sportInput.dataset.value || sportInput.value;

        console.log('Start session - Region ID:', regionId, 'Sport ID:', sportId);
        console.log('Region input value:', regionInput.value, 'dataset:', regionInput.dataset.value);
        console.log('Sport input value:', sportInput.value, 'dataset:', sportInput.dataset.value);

        if (!regionId || !sportId) {
            this.showNotification('Please select region and sport', 'error');
            return;
        }

        try {
            // Get region name for default bucket name
            const regionInput = document.getElementById('region');
            const regionValue = regionInput.value || '';
            const regionName = regionValue.includes(' - ') ? regionValue.split(' - ')[0] : regionValue;
            
            // Generate default bucket name: region/DD-MM-YYYY
            const today = new Date();
            const day = today.getDate().toString().padStart(2, '0');
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const year = today.getFullYear().toString();
            const dateStr = `${day}-${month}-${year}`;
            const defaultBucketName = `${regionName}/${dateStr}`;
            
            // Set default bucket name if empty
            const bucketInput = document.getElementById('bucket-name');
            if (!bucketInput.value.trim()) {
                bucketInput.value = defaultBucketName;
            }
            
            // Get sport name for session
            const sportValue = sportInput.value || '';
            const sportName = sportValue.includes(' - ') ? sportValue.split(' - ')[0].trim() : sportValue.trim();
            
            console.log('DEBUG: sportName extracted:', sportName);
            
            // Lock UI state (no API call needed)
            this.currentSession = { regionId, sportId, sportName };
            
            // Disable region and sport selects
            document.getElementById('region').disabled = true;
            document.getElementById('sport').disabled = true;
            document.getElementById('start-session-btn').disabled = true;
            
            // Show stop session button
            document.getElementById('stop-session-btn').classList.remove('hidden');
            
            // Update UI
            this.updateSessionStatus('active');
            this.showNotification('Session started! Press Ctrl+Shift+Q to take screenshots.', 'success');
            
        } catch (error) {
            this.showNotification('Failed to start session: ' + error.message, 'error');
        }
    }

    stopSession() {
        try {
            // Reset session data
            this.currentSession = null;
            
            // Enable region and sport selects
            document.getElementById('region').disabled = false;
            document.getElementById('sport').disabled = false;
            document.getElementById('start-session-btn').disabled = false;
            
            // Hide stop session button
            document.getElementById('stop-session-btn').classList.add('hidden');
            
            // Clear bucket name
            document.getElementById('bucket-name').value = '';
            
            // Update UI
            this.updateSessionStatus('Not Started');
            this.showNotification('Session stopped. You can start a new session.', 'info');
            
        } catch (error) {
            this.showNotification('Failed to stop session: ' + error.message, 'error');
        }
    }

    async takeScreenshot() {
        if (!this.currentSession) {
            this.showNotification('Please start a session first', 'error');
            return;
        }

        try {
            // Ultra-fast UI feedback
            this.showLoading('Taking screenshot...');
            
            // Call main process to take screenshot (non-blocking)
            const result = await ipcRenderer.invoke('take-screenshot');
            
            if (result.success) {
                // Store screenshot data for upload
                this.screenshotData = result.data;
                this.showScreenshotPreview();
                this.showNotification('Screenshot taken! Ready to upload.', 'success');
            } else {
                this.showNotification('Screenshot failed: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('Screenshot failed: ' + error.message, 'error');
        } finally {
            // Hide loading immediately for better UX
            setTimeout(() => this.hideLoading(), 100);
        }
    }

    async detectUrl() {
        try {
            this.showLoading('Detecting URL...');
            
            // Call main process to detect URL
            const result = await ipcRenderer.invoke('detect-url');
            
            if (result.success) {
                this.showNotification('URL detection started...', 'info');
            } else {
                this.showNotification('URL detection failed: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('URL detection failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async detectUrlFromClipboard() {
        try {
            this.showLoading('Checking clipboard...');
            
            // Get URL from clipboard via main process
            const result = await ipcRenderer.invoke('get-url-from-clipboard');
            
            if (result.success && result.url) {
                document.getElementById('url').value = result.url;
                this.showNotification('URL detected from clipboard!', 'success');
            } else {
                this.showNotification('No URL found in clipboard. Please copy a URL first.', 'error');
            }
        } catch (error) {
            this.showNotification('Clipboard detection failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async triggerExtensionUrlDetection() {
        try {
            console.log('Triggering browser extension to send URL...');
            
            // Just show a notification to user
            this.showNotification('Requesting URL from browser extension...', 'info');
            
        } catch (error) {
            console.error('Error triggering extension:', error);
        }
    }

    showScreenshotPreview() {
        const preview = document.getElementById('screenshot-preview');
        const image = document.getElementById('screenshot-image');
        
        if (this.screenshotData && this.screenshotData.path) {
            // Load image from local file path
            image.src = `file://${this.screenshotData.path}`;
            preview.classList.remove('hidden');
        }
        
        // Don't auto detect URL - only use manual input or extension
    }

    async uploadScreenshot() {
        // Check if popup is visible to determine which signal to use
        const popup = document.getElementById('screenshot-popup');
        const isPopupVisible = !popup.classList.contains('hidden');
        
        let signalId, url, bucketName;
        
        if (isPopupVisible) {
            // Use popup-specific method
            this.uploadScreenshotFromPopup();
            return;
        } else {
            // Use main page signal and data
            const signalInput = document.getElementById('signal');
            signalId = signalInput.dataset.value || signalInput.value;
            url = document.getElementById('url').value;
            bucketName = document.getElementById('bucket-name').value;
        }

        if (!signalId) {
            this.showNotification('Please select a signal', 'error');
            return;
        }

        if (!url) {
            this.showNotification('Please enter or detect URL', 'error');
            return;
        }

        if (!bucketName) {
            this.showNotification('Please enter storage folder name', 'error');
            return;
        }

        if (!this.screenshotData || !this.screenshotData.path) {
            this.showNotification('No screenshot available', 'error');
            return;
        }

        // QUEUE UPLOAD (background processing) - immediate feedback
        const signalName = document.getElementById('signal').value;
        
        // Use current URL from input field (most up-to-date)
        const currentUrl = document.getElementById('url').value;
        console.log('📤 Adding to queue with URL:', currentUrl);
        
        // Add to upload queue for background processing
        const queueId = this.addToUploadQueue(signalId, currentUrl, bucketName, signalName);
        
        if (queueId) {
            // Immediate feedback - no waiting for API
            this.showNotification('📤 Upload added to queue! Processing in background...', 'success');
            this.hideScreenshotPreview();
            this.clearForm();
            this.hideAppToBackground();
        }
    }

    async uploadScreenshotBackground(queueItem) {
        const { signalId, url, bucketName, sportId, assignedUserId, filePath } = queueItem;
        try {
            console.log('Starting background upload for queue item:', queueItem.id);
            console.log('Queue item data:', {
                signalId,
                url,
                bucketName,
                sportId,
                assignedUserId,
                filePath
            });
            
            // Check if all required data is available
            if (!sportId || !assignedUserId || !filePath) {
                queueItem.status = 'error';
                queueItem.error = 'Missing required data: sportId, assignedUserId, or filePath';
                this.updateQueueDisplay();
                this.showErrorPopupWithDetails(queueItem);
                return;
            }
            
            // Step 1: Check if URL already exists
            console.log('🔍 Checking URL existence:', url);
            const urlCheckResult = await ipcRenderer.invoke('check-url-exists', url);
            
            if (urlCheckResult.success && urlCheckResult.exists) {
                console.log('❌ URL already exists in database');
                queueItem.status = 'error';
                queueItem.error = 'URL already exists in database! Please navigate to a different URL and try again.';
                this.updateQueueDisplay();
                this.showErrorPopupWithDetails(queueItem);
                return;
            }
            
            console.log('✅ URL is new, proceeding with upload');
            
            // Step 2: Create detected link
            console.log('🔗 Creating detected link for URL:', url);
            const linkResult = await ipcRenderer.invoke('create-detected-link', {
                url: url,
                sportId: sportId,
                assignedUserId: assignedUserId
            });
            
            // Handle link creation result
            if (!linkResult.success) {
                queueItem.status = 'error';
                queueItem.error = 'Failed to create detected link: ' + linkResult.error + '. Make sure backend server is running on port 8000.';
                this.updateQueueDisplay();
                this.showErrorPopupWithDetails(queueItem);
                return;
            }
            
            console.log('✅ Detected link created:', linkResult.data);
            
            // Step 3: Upload screenshot
            const uploadData = {
                filePath: filePath,
                detectedLinkId: linkResult.data.id,
                bucketName: bucketName
            };
            
            console.log('📤 Uploading screenshot with data:', uploadData);
            const uploadResult = await ipcRenderer.invoke('upload-screenshot', uploadData);
            
            if (uploadResult.success) {
                // Success - update queue item
                queueItem.status = 'success';
                queueItem.imageUrl = uploadResult.data?.image_url || uploadResult.imageUrl;
                this.updateQueueDisplay();
                
                // Show success notification
                this.showSuccessNotification(`✅ Screenshot uploaded successfully to folder: ${bucketName}!`);
                console.log('✅ Upload completed successfully');
            } else {
                // Error - update queue item and show error popup
                queueItem.status = 'error';
                queueItem.error = 'Upload failed: ' + uploadResult.error;
                this.updateQueueDisplay();
                
                // Show error popup with URL and details
                this.showErrorPopupWithDetails(queueItem);
                console.log('❌ Upload failed:', uploadResult.error);
            }
        } catch (error) {
            // Error - update queue item
            queueItem.status = 'error';
            queueItem.error = 'Failed to upload: ' + error.message;
            this.updateQueueDisplay();
            
            // Show error popup with URL and details
            this.showErrorPopupWithDetails(queueItem);
            console.log('❌ Upload error:', error);
        }
    }

    hideAppToBackground() {
        // Hide main window to background
        ipcRenderer.invoke('minimize-window');
        
        // Clear form for next screenshot
        this.clearForm();
        this.hideScreenshotPreview();
    }

    showSuccessNotification(message) {
        // Show success notification without bringing app to front
        this.showNotification(message, 'success');
    }

    cancelScreenshot() {
        // Check if popup is visible
        const popup = document.getElementById('screenshot-popup');
        const isPopupVisible = !popup.classList.contains('hidden');
        
        if (isPopupVisible) {
            // Handle popup cancel
            this.handlePopupCancel();
        } else {
            // Handle main page cancel
        this.hideScreenshotPreview();
        this.screenshotData = null;
        this.showNotification('Screenshot cancelled', 'info');
        }
    }

    confirmUpload() {
        this.uploadScreenshot();
    }

    cancelUpload() {
        this.hideScreenshotPreview();
        this.screenshotData = null;
    }

    hideScreenshotPreview() {
        document.getElementById('screenshot-preview').classList.add('hidden');
    }

    clearForm() {
        document.getElementById('signal').value = '';
        // Keep URL and bucket-name for next screenshot
        // document.getElementById('url').value = ''; // DON'T clear URL!
    }

    resetSession() {
        // Reset session data
        this.currentSession = null;
        this.screenshotData = null;
        
        // Reset UI
        document.getElementById('region').disabled = false;
        document.getElementById('sport').disabled = false;
        document.getElementById('start-session-btn').disabled = false;
        document.getElementById('stop-session-btn').classList.add('hidden');
        
        // Clear form fields
        document.getElementById('region').value = '';
        document.getElementById('sport').value = '';
        document.getElementById('signal').value = '';
        document.getElementById('url').value = '';
        document.getElementById('bucket-name').value = '';
        
        // Clear input fields
        document.getElementById('region').value = '';
        document.getElementById('sport').value = '';
        document.getElementById('signal').value = '';
        
        // Clear dataset values
        document.getElementById('region').dataset.value = '';
        document.getElementById('sport').dataset.value = '';
        document.getElementById('signal').dataset.value = '';
        
        // Hide dropdowns
        document.getElementById('region-dropdown').classList.add('hidden');
        document.getElementById('sport-dropdown').classList.add('hidden');
        document.getElementById('signal-dropdown').classList.add('hidden');
        
        // Update status
        this.updateSessionStatus('Not Started');
    }

    handleScreenshotTaken(data) {
        this.screenshotData = data;
        // Don't auto detect URL - only use manual input or extension
        this.showScreenshotPopup(data);
        this.showNotification('Screenshot taken via hotkey!', 'success');
    }

    handleUrlDetectionRequest(data) {
        this.showNotification(data.message, 'warning');
    }

    handleUrlAlreadyExists(data) {
        this.showErrorPopup(data.message);
    }

    showErrorPopup(message) {
        // 1. Tạo system notification trước
        this.showSystemNotification();
        
        // 2. Tạo popup báo lỗi toàn màn hình
        const popup = document.createElement('div');
        popup.className = 'error-popup-fullscreen';
        popup.innerHTML = `
            <div class="error-popup-content-fullscreen">
                <div class="error-popup-header-fullscreen">
                    <span class="error-icon-fullscreen">⚠️</span>
                    <h2>URL Already Exists!</h2>
                </div>
                <div class="error-popup-body-fullscreen">
                    <p class="error-message">${message}</p>
                    <div class="error-details">
                        <p>🔍 <strong>What happened?</strong></p>
                        <p>The URL you're trying to capture already exists in our database.</p>
                        <p>📝 <strong>What to do?</strong></p>
                        <p>Please navigate to a different URL and try again.</p>
                    </div>
                </div>
                <div class="error-popup-footer-fullscreen">
                    <button class="error-popup-btn-fullscreen" onclick="this.closest('.error-popup-fullscreen').remove()">
                        Got it! I'll try a different URL
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // 3. Thêm hiệu ứng âm thanh
        this.playErrorSound();
        
        // 4. Flash window để thu hút sự chú ý
        this.flashWindow();
        
        // 5. Auto remove after 10 seconds (lâu hơn để user đọc)
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
        }, 10000);
    }

    showSystemNotification() {
        // Tạo system notification
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification('URL Already Exists!', {
                    body: 'The URL you\'re trying to capture already exists in our database. Please navigate to a different URL.',
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff4757"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
                    tag: 'url-exists-error',
                    requireInteraction: true
                });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification('URL Already Exists!', {
                            body: 'The URL you\'re trying to capture already exists in our database. Please navigate to a different URL.',
                            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff4757"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
                            tag: 'url-exists-error',
                            requireInteraction: true
                        });
                    }
                });
            }
        }
    }

    flashWindow() {
        // Flash window để thu hút sự chú ý
        try {
            // Gửi message đến main process để flash window
            ipcRenderer.send('flash-window');
        } catch (e) {
            console.log('Could not flash window:', e);
        }
    }

    playErrorSound() {
        // Tạo âm thanh báo lỗi
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            // Fallback: sử dụng system beep
            console.log('\a'); // ASCII bell character
        }
    }

    async handleUrlDetected(url) {
        document.getElementById('url').value = url;
        this.showNotification('URL detected via hotkey!', 'success');
        
        // Update screenshot data with new URL if it exists
        if (this.screenshotData) {
            this.screenshotData.url = url;
            console.log('🔄 Updated screenshot data with new URL:', url);
        }
        
        // Update any pending queue items with new URL
        this.uploadQueue.forEach(item => {
            if (item.status === 'uploading') {
                console.log('🔄 Updating queue item URL from', item.url, 'to', url);
                item.url = url;
            }
        });
        
        // Check if URL already exists in database
        try {
            console.log('🔍 Checking URL existence:', url);
            const urlCheckResult = await ipcRenderer.invoke('check-url-exists', url);
            
            if (urlCheckResult.success && urlCheckResult.exists) {
                console.log('❌ URL already exists in database');
                this.showNotification('⚠️ URL already exists in database! Please navigate to a different URL.', 'error');
            } else {
                console.log('✅ URL is new, ready for screenshot');
                this.showNotification('✅ URL is new, ready for screenshot!', 'success');
            }
        } catch (error) {
            console.log('❌ Error checking URL existence:', error);
            this.showNotification('⚠️ Could not check URL existence. Proceed with caution.', 'info');
        }
    }

    showScreenshotPopup(data) {
        const popup = document.getElementById('screenshot-popup');
        const filenameEl = document.getElementById('popup-filename');
        const urlEl = document.getElementById('popup-url');
        const timeEl = document.getElementById('popup-time');
        const imageEl = document.getElementById('popup-screenshot-image');
        const signalInput = document.getElementById('popup-signal');

        // Populate popup data
        filenameEl.textContent = data.filename || 'screenshot.png';
        // ONLY use main page URL - no auto detect
        const mainPageUrl = document.getElementById('url').value;
        urlEl.textContent = mainPageUrl || 'No URL detected';
        timeEl.textContent = new Date(data.timestamp).toLocaleString();
        
        // Load screenshot image
        if (data.path) {
            imageEl.src = `file://${data.path}`;
        }

        // Clear popup signal input
        signalInput.value = '';
        signalInput.dataset.value = '';
        
        // Load signals for popup (will be loaded when user focuses on input)
        // No need to populate here - let single input logic handle it

        // Show popup
        popup.classList.remove('hidden');
        
        // Focus on signal input
        setTimeout(() => {
            signalInput.focus();
        }, 100);
    }

    hideScreenshotPopup() {
        const popup = document.getElementById('screenshot-popup');
        popup.classList.add('hidden');
    }

    handlePopupOk() {
        const signalInput = document.getElementById('popup-signal');
        const selectedSignal = signalInput.dataset.value || signalInput.value;

        if (!selectedSignal) {
            this.showNotification('Please select a signal', 'error');
            return;
        }

        if (!this.screenshotData || !this.screenshotData.path) {
            this.showNotification('No screenshot available', 'error');
            return;
        }

        // Upload screenshot
        this.uploadScreenshotFromPopup();
    }

    handlePopupCancel() {
        this.hideScreenshotPopup();
        
        // Clean up screenshot file
        if (this.screenshotData && this.screenshotData.path) {
            // Note: In a real app, you might want to delete the temp file
            console.log('Screenshot cancelled, file:', this.screenshotData.path);
        }
        
        this.screenshotData = null;
        this.showNotification('Screenshot cancelled', 'info');
    }

    async uploadScreenshotFromPopup() {
        console.log('=== POPUP UPLOAD DEBUG ===');
        console.log('Screenshot data:', this.screenshotData);
        console.log('Main page URL:', document.getElementById('url').value);
        
        const signalInput = document.getElementById('popup-signal');
        const selectedSignal = signalInput.dataset.value || signalInput.value;
        // Use main page URL instead of screenshotData.url
        const url = document.getElementById('url').value;
        const bucketName = document.getElementById('bucket-name').value;

        console.log('URL check:', url);
        console.log('Bucket name:', bucketName);
        console.log('Selected signal:', selectedSignal);

        if (!url || url === 'No URL detected') {
            console.log('❌ No URL available for upload');
            this.showNotification('No URL available for upload', 'error');
            return;
        }

        if (!bucketName) {
            this.showNotification('Please enter storage folder name', 'error');
                return;
        }

        if (!selectedSignal) {
            this.showNotification('Please select a signal', 'error');
                return;
            }
            
        // QUEUE UPLOAD (background processing) - immediate feedback
        const signalName = document.getElementById('popup-signal').value;
        
        // Use current URL from input field (most up-to-date)
        const currentUrl = document.getElementById('url').value;
        console.log('📤 Adding to queue with URL (popup):', currentUrl);
        
        // Add to upload queue for background processing
        const queueId = this.addToUploadQueue(selectedSignal, currentUrl, bucketName, signalName);
        
        if (queueId) {
            // Immediate feedback - no waiting for API
            this.showNotification('📤 Upload added to queue! Processing in background...', 'success');
            this.hideScreenshotPreview();
            this.clearForm();
            this.hideScreenshotPopup();
        }
    }

    updateSessionStatus(status) {
        const statusElement = document.getElementById('session-status');
        statusElement.textContent = status;
        statusElement.className = `step-status ${status === 'active' ? 'active' : 'ready'}`;
    }

    updateStatus(message) {
        document.getElementById('status-text').textContent = message;
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notification-text');
        
        text.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.remove('hidden');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 5000);
    }

    showLoading(message) {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('loading-text');
        
        text.textContent = message;
        overlay.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    async apiCall(method, endpoint, data = null) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    console.error('API Error Response:', errorData);
                    
                    if (errorData.detail) {
                        errorMessage = errorData.detail;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (Array.isArray(errorData)) {
                        errorMessage = errorData.map(err => err.msg || err.message || err).join(', ');
                    }
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                }
                throw new Error(errorMessage);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw new Error(`API call failed: ${error.message}`);
        }
    }

    async apiCallWithAuth(method, endpoint, data = null) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                }
            };

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    console.error('API Error Response:', errorData);
                    
                    if (errorData.detail) {
                        errorMessage = errorData.detail;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (Array.isArray(errorData)) {
                        errorMessage = errorData.map(err => err.msg || err.message || err).join(', ');
                    }
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                }
                throw new Error(errorMessage);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw new Error(`API call failed: ${error.message}`);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new TestAutomationDesktopApp();
    
    // Add event listeners for new events
    ipcRenderer.on('url-detection-request', (event, data) => {
        app.handleUrlDetectionRequest(data);
    });
    
    ipcRenderer.on('url-already-exists', (event, data) => {
        app.handleUrlAlreadyExists(data);
    });
});

// Handle notification close
document.getElementById('notification-close').addEventListener('click', () => {
    document.getElementById('notification').classList.add('hidden');
});
