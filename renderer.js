// Modern JavaScript for Electron Desktop App
const { ipcRenderer } = require('electron');
const config = require('./app.config');

// Import modules
const UiService = require('./modules/ui/uiService');
const SessionService = require('./modules/session/sessionService');

class TestAutomationDesktopApp {
    constructor() {
        this.currentUser = null;
        this.screenshotData = null;
        this.signals = [];
        this.apiBaseUrl = config.apiBaseUrl; // Use config from app.config.js
        
        // Initialize services
        this.uiService = new UiService();
        this.sessionService = new SessionService();
        
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
            // Keep default API URL from config
            console.log('🌐 Using config API Base URL:', this.apiBaseUrl);
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
        
        // Create signal functionality
        this.setupCreateSignalHandlers();
        
        // Listen for custom event to load popup signals
        document.addEventListener('loadPopupSignals', (event) => {
            const { page, query, isNewSearch } = event.detail;
            this.loadPopupSignals(page, query, isNewSearch);
        });

        // Sport filter inputs - reload sports when filters change
        this.setupSportFilterListeners();

        // Global keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Upload queue system - ENABLED (background processing)
        // Note: Upload queue is now handled by UiService

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

        document.getElementById('popup-open-location-btn').addEventListener('click', () => {
            this.openScreenshotLocation();
        });

        // IPC events from main process (optimized for speed)
        ipcRenderer.on('screenshot-taken', (event, data) => {
            this.handleScreenshotTaken(data);
        });

        ipcRenderer.on('screenshot-failed', (event, data) => {
            this.showNotification('Screenshot failed: ' + data.error, 'error');
            this.hideLoading();
        });

        ipcRenderer.on('url-already-exists', (event, data) => {
            this.showErrorPopup(data.message);
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
        
        
        // Trigger change event so other handlers can react
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);
        
        // Hide dropdown
        document.getElementById(`${inputId}-dropdown`).classList.add('hidden');
        
        // Show success
        this.showNotification(`${inputId} selected: ${text}`, 'success');
        
        // Special handling for region -> load sports
        if (inputId === 'region') {
            this.loadSports(value, 1, '', true);
        }
    }

    setupSportFilterListeners() {
        // Get all sport filter inputs
        const leagueInput = document.getElementById('sport-league');
        const matchNameInput = document.getElementById('sport-match-name');
        const startTimeInput = document.getElementById('sport-start-time');
        const endTimeInput = document.getElementById('sport-end-time');
        
        const reloadSports = () => {
            const regionInput = document.getElementById('region');
            const regionId = regionInput?.dataset.value;
            
            // Only reload if region is selected
            if (regionId) {
                this.loadSports(regionId, 1, '', true);
            }
        };
        
        // Add event listeners for ENTER key and BLUR (click outside)
        const filterInputs = [leagueInput, matchNameInput, startTimeInput, endTimeInput];
        
        filterInputs.forEach(input => {
            if (input) {
                // Reload on Enter key
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        reloadSports();
                    }
                });
                
                // Reload when user clicks outside (blur)
                input.addEventListener('blur', () => {
                    reloadSports();
                });
            }
        });
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
            
            console.log('🔐 Attempting login to:', `${this.apiBaseUrl}/auth/login`);
            console.log('👤 Username:', username);
            
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
                console.error('❌ Login failed:', response.status, response.statusText);
                const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
                console.error('❌ Error details:', errorData);
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
                
                // Set user in session service
                this.sessionService.setCurrentUser(userData);
                
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
        
        // Clear session service
        this.sessionService.resetSession();
        
        // Clear upload queue
        this.uiService.clearUploadQueue();
        
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
        this.uiService.showMainInterface(user);
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
            
            // Get filter values from inputs
            const leagueFilter = document.getElementById('sport-league')?.value.trim();
            const matchNameFilter = document.getElementById('sport-match-name')?.value.trim();
            const startTimeFilter = document.getElementById('sport-start-time')?.value;
            const endTimeFilter = document.getElementById('sport-end-time')?.value;
            
            // Apply filters (if provided, they override the search query)
            if (leagueFilter) {
                params.append('league', leagueFilter);
            } else if (query) {
                // Use search query only if no league filter
                params.append('league', query);
            }
            
            if (matchNameFilter) {
                params.append('match_name', matchNameFilter);
            }
            
            if (startTimeFilter) {
                params.append('start_time', startTimeFilter);
            }
            
            if (endTimeFilter) {
                params.append('end_time', endTimeFilter);
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

    setupCreateSignalHandlers() {
        // Show create signal form
        document.getElementById('show-create-signal-btn').addEventListener('click', () => {
            this.showCreateSignalForm();
        });

        // Cancel create signal
        document.getElementById('cancel-create-signal-btn').addEventListener('click', () => {
            this.hideCreateSignalForm();
        });

        document.getElementById('cancel-create-signal-btn2').addEventListener('click', () => {
            this.hideCreateSignalForm();
        });

        // Create signal
        document.getElementById('create-signal-btn').addEventListener('click', () => {
            this.createNewSignal();
        });
    }

    showCreateSignalForm() {
        // Hide signal dropdown and show create form
        document.getElementById('popup-signal-dropdown').classList.add('hidden');
        document.getElementById('create-signal-section').classList.remove('hidden');
        document.getElementById('show-create-signal-btn').classList.add('hidden');
        
        // Clear form
        document.getElementById('new-signal-name').value = '';
        document.getElementById('new-signal-description').value = '';
        
        // Focus on signal name input
        document.getElementById('new-signal-name').focus();
    }

    hideCreateSignalForm() {
        // Hide create form and show create button
        document.getElementById('create-signal-section').classList.add('hidden');
        document.getElementById('show-create-signal-btn').classList.remove('hidden');
        
        // Clear form
        document.getElementById('new-signal-name').value = '';
        document.getElementById('new-signal-description').value = '';
    }

    async createNewSignal() {
        const signalName = document.getElementById('new-signal-name').value.trim();
        const description = document.getElementById('new-signal-description').value.trim();

        if (!signalName) {
            this.showNotification('Please enter signal name', 'error');
            document.getElementById('new-signal-name').focus();
            return;
        }

        try {
            this.showLoading('Creating signal...');

            // Prepare signal data
            const signalData = {
                signal_name: signalName
            };

            if (description) {
                signalData.description = description;
            }

            // Call API to create signal
            const result = await ipcRenderer.invoke('create-signal', signalData);

            if (result.success) {
                // Set the newly created signal as selected
                const input = document.getElementById('popup-signal');
                input.value = result.data.signal_name;
                input.dataset.value = result.data.id;
                
                // Hide create form
                this.hideCreateSignalForm();
                
                // Show success
                this.showNotification(`Signal "${signalName}" created successfully!`, 'success');
            } else {
                this.showNotification('Failed to create signal: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error creating signal: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    setupKeyboardShortcuts() {
        // Remove existing event listener if any
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }
        
        this.keyboardHandler = (e) => {
            // Check if screenshot popup is visible
            const popup = document.getElementById('screenshot-popup');
            const isPopupVisible = popup && !popup.classList.contains('hidden');
            
            // Check if error popup is visible
            const errorPopup = document.querySelector('.error-popup-fullscreen');
            const isErrorPopupVisible = errorPopup !== null;
            
            // Debug logging only for Escape key
            if (e.key === 'Escape') {
                console.log('ESC key pressed - checking popups:', {
                    isPopupVisible,
                    isErrorPopupVisible,
                    popupElement: popup,
                    errorPopupElement: errorPopup,
                    allErrorPopups: document.querySelectorAll('.error-popup-fullscreen'),
                    allErrorPopupsLength: document.querySelectorAll('.error-popup-fullscreen').length,
                    documentBody: document.body.innerHTML.includes('error-popup-fullscreen')
                });
            }
            
            // Handle Escape key - prioritize error popup if both are visible
            if (e.key === 'Escape') {
                if (isErrorPopupVisible) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Escape pressed - Closing error popup');
                    errorPopup.remove();
                    return;
                } else if (isPopupVisible) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Escape pressed - Canceling screenshot');
                    this.cancelScreenshot();
                    return;
                }
            }
            
            // Handle other shortcuts only for screenshot popup
            if (isPopupVisible) {
                // Ctrl+Shift+U = Upload Screenshot
                if (e.ctrlKey && e.shiftKey && e.key === 'U') {
                    e.preventDefault();
                    console.log('Ctrl+Shift+U pressed - Uploading screenshot');
                    this.uploadScreenshot();
                }
            }
        };
        
        document.addEventListener('keydown', this.keyboardHandler);
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
            
            // Get sport name for bucket name
            const sportInput = document.getElementById('sport');
            const sportValue = sportInput.value || '';
            const sportName = sportValue.includes(' - ') ? sportValue.split(' - ')[0].trim() : sportValue.trim();
            
            // Generate default bucket name: region/DD-MM-YYYY/league - match_name - start_time
            const today = new Date();
            const day = today.getDate().toString().padStart(2, '0');
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const year = today.getFullYear().toString();
            const dateStr = `${day}-${month}-${year}`;
            
            // Create sport info part: league - match_name
            let sportInfo = '';
            if (sportName) {
                // Extract league and match_name from sport value
                const sportParts = sportValue.split(' - ');
                if (sportParts.length >= 2) {
                    const league = sportParts[0].trim();
                    const matchName = sportParts[1].trim();
                    sportInfo = `${league} ${matchName}`;
                } else {
                    sportInfo = sportName;
                }
            }
            
            // Build final bucket name
            let defaultBucketName = `${regionName}/${dateStr}`;
            if (sportInfo) {
                defaultBucketName += `/${sportInfo}`;
            }
            
            // Set default bucket name if empty
            const bucketInput = document.getElementById('bucket-name');
            if (!bucketInput.value.trim()) {
                bucketInput.value = defaultBucketName;
            }
            
            // Get sport name for session (reuse from above)
            
            console.log('DEBUG: sportName extracted:', sportName);
            
            // Use session service to start session
            const result = this.sessionService.startSession(regionId, sportId, sportName);
            
            if (result.success) {
                // Update UI
                this.updateSessionStatus('active');
                this.showNotification('Session started! Press Ctrl+Shift+Q to take screenshots.', 'success');
            } else {
                this.showNotification('Failed to start session: ' + result.error, 'error');
            }
            
        } catch (error) {
            this.showNotification('Failed to start session: ' + error.message, 'error');
        }
    }

    stopSession() {
        try {
            // Use session service to stop session
            const result = this.sessionService.stopSession();
            
            if (result.success) {
                // Update UI
                this.updateSessionStatus('Not Started');
                this.showNotification('Session stopped. You can start a new session.', 'info');
            } else {
                this.showNotification('Failed to stop session: ' + result.error, 'error');
            }
            
        } catch (error) {
            this.showNotification('Failed to stop session: ' + error.message, 'error');
        }
    }

    async takeScreenshot() {
        if (!this.sessionService.isSessionActive()) {
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
        this.uiService.showScreenshotPreview(this.screenshotData);
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
        
        // Get session and user data
        const sessionData = this.sessionService.getSessionData();
        const userData = this.sessionService.getCurrentUser();
        
        // Add to upload queue for background processing
        const queueId = this.uiService.addToUploadQueue(signalId, currentUrl, bucketName, signalName, this.screenshotData, sessionData, userData);
        
        if (queueId) {
            // Immediate feedback - no waiting for API
            this.showNotification('📤 Upload added to queue! Processing in background...', 'success');
            this.hideScreenshotPreview();
            this.clearForm();
            this.hideAppToBackground();
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
        this.uiService.hideScreenshotPreview();
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
        
        // 2. Xóa error popup cũ nếu có
        const existingErrorPopups = document.querySelectorAll('.error-popup-fullscreen');
        existingErrorPopups.forEach(popup => popup.remove());
        
        // 3. Tạo popup báo lỗi toàn màn hình
        const popup = document.createElement('div');
        popup.className = 'error-popup-fullscreen';
        popup.tabIndex = -1; // Cho phép popup nhận focus
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
        
        // Focus vào popup để có thể nhận keyboard events
        popup.focus();
        
        // 3. Sử dụng global keyboard shortcut thay vì event listener
        const escHandler = (e) => {
            console.log('Global ESC handler triggered, key:', e.key, 'target:', e.target);
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                console.log('Global ESC key pressed - removing error popup');
                popup.remove();
                document.removeEventListener('keydown', escHandler);
                return false;
            }
        };
        
        // Thêm global event listener
        document.addEventListener('keydown', escHandler);
        
        // 6. Thêm IPC listener để nhận ESC key từ main process
        const ipcEscHandler = () => {
            console.log('IPC ESC key received - removing error popup');
            popup.remove();
            document.removeEventListener('keydown', escHandler);
            document.removeEventListener('click', clickHandler);
            ipcRenderer.removeListener('close-error-popup', ipcEscHandler);
        };
        ipcRenderer.on('close-error-popup', ipcEscHandler);
        
        // 4. Thêm click listener để đóng popup khi click outside
        const clickHandler = (e) => {
            if (e.target === popup) {
                console.log('Clicked outside error popup - closing');
                popup.remove();
                document.removeEventListener('keydown', escHandler);
                document.removeEventListener('click', clickHandler);
            }
        };
        document.addEventListener('click', clickHandler);
        
        // 5. Thêm ESC key listener trực tiếp vào popup element
        popup.addEventListener('keydown', (e) => {
            console.log('Popup ESC key, key:', e.key);
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                console.log('Popup ESC key pressed - removing popup');
                popup.remove();
                return false;
            }
        });
        
        // 4. Thêm hiệu ứng âm thanh
        this.playErrorSound();
        
        // 5. Flash window để thu hút sự chú ý
        this.flashWindow();
        
        // 7. Auto remove after 10 seconds (lâu hơn để user đọc)
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
                document.removeEventListener('keydown', escHandler);
                document.removeEventListener('click', clickHandler);
                ipcRenderer.removeListener('close-error-popup', ipcEscHandler);
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
        if (this.uploadQueue && Array.isArray(this.uploadQueue)) {
            this.uploadQueue.forEach(item => {
                if (item.status === 'uploading') {
                    console.log('🔄 Updating queue item URL from', item.url, 'to', url);
                    item.url = url;
                }
            });
        }
        
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
        this.uiService.showScreenshotPopup(data);
    }

    hideScreenshotPopup() {
        this.uiService.hideScreenshotPopup();
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
            console.log('Screenshot cancelled, deleting file:', this.screenshotData.path);
            // Delete the screenshot file
            ipcRenderer.invoke('delete-file', this.screenshotData.path).then(() => {
                console.log('Screenshot file deleted successfully');
            }).catch(error => {
                console.error('Failed to delete screenshot file:', error);
            });
        }
        
        this.screenshotData = null;
        this.showNotification('Screenshot cancelled', 'info');
    }

    openScreenshotLocation() {
        if (this.screenshotData && this.screenshotData.path) {
            console.log('Opening screenshot file:', this.screenshotData.path);
            
            // Open the specific screenshot file
            ipcRenderer.invoke('open-file', this.screenshotData.path).then(() => {
                console.log('Screenshot file opened successfully');
            }).catch(error => {
                console.error('Failed to open screenshot file:', error);
                this.showNotification('Failed to open screenshot file', 'error');
            });
        } else {
            this.showNotification('No screenshot data available', 'warning');
        }
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
        
        // Get session and user data
        const sessionData = this.sessionService.getSessionData();
        const userData = this.sessionService.getCurrentUser();
        
        // Add to upload queue for background processing
        const queueId = this.uiService.addToUploadQueue(selectedSignal, currentUrl, bucketName, signalName, this.screenshotData, sessionData, userData);
        
        if (queueId) {
            // Immediate feedback - no waiting for API
            this.showNotification('📤 Upload added to queue! Processing in background...', 'success');
            this.hideScreenshotPreview();
            this.clearForm();
            this.hideScreenshotPopup();
        }
    }

    updateSessionStatus(status) {
        this.uiService.updateSessionStatus(status);
    }

    updateStatus(message) {
        document.getElementById('status-text').textContent = message;
    }

    showNotification(message, type = 'info') {
        this.uiService.showNotification(message, type);
    }

    showLoading(message) {
        this.uiService.showLoading(message);
    }

    hideLoading() {
        this.uiService.hideLoading();
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
    
});

// Handle notification close
document.getElementById('notification-close').addEventListener('click', () => {
    document.getElementById('notification').classList.add('hidden');
});
