// UI Service Module - Handles UI operations and notifications
const { ipcRenderer } = require('electron');

class UiService {
    constructor() {
        this.uploadQueue = [];
        this.notificationTimeout = null;
        this.wasVisibleBeforeScreenshot = true; // Track if window was visible before screenshot
        this.notificationHistory = []; // Track all notifications
        this.setupUploadQueue();
        this.setupNotificationClose();
        this.setupNotificationClearAll();
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

        // Clear All button (remove all except errors)
        const clearAllBtn = document.getElementById('queue-clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearUploadQueueExceptErrors();
            });
        }
    }

    setupNotificationClose() {
        const closeBtn = document.getElementById('notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideNotification();
            });
        }
    }

    setupNotificationClearAll() {
        const clearAllBtn = document.getElementById('notification-clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllNotifications();
            });
        }
    }

    hideNotification() {
        const notification = document.getElementById('notification');
        notification.classList.add('hidden');
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
            this.notificationTimeout = null;
        }
    }

    clearAllNotifications() {
        const notification = document.getElementById('notification');
        const notificationType = notification.className.split(' ').find(cls => 
            ['success', 'info', 'error', 'warning'].includes(cls)
        );
        
        // Only clear if it's NOT an error
        if (notificationType !== 'error') {
            console.log('🗑️ Clearing all non-error notifications');
            this.hideNotification();
            
            // Also clear from history
            this.notificationHistory = this.notificationHistory.filter(n => n.type === 'error');
            
            // Show confirmation (briefly)
            this.showNotification('✅ All notifications cleared (errors kept)', 'success');
            setTimeout(() => {
                const currentType = document.getElementById('notification').className.split(' ').find(cls => 
                    ['success', 'info', 'error', 'warning'].includes(cls)
                );
                if (currentType !== 'error') {
                    this.hideNotification();
                }
            }, 2000);
        } else {
            // If it's an error, show message that errors cannot be cleared
            this.showNotification('⚠️ Error notifications cannot be cleared automatically. Please close them manually.', 'info');
        }
    }

    async showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notification-text');
        
        // Add to history
        this.notificationHistory.push({
            message,
            type,
            timestamp: Date.now()
        });
        
        text.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.remove('hidden');

        // Show/hide Clear All button based on notification type
        const clearAllBtn = document.getElementById('notification-clear-all');
        if (clearAllBtn) {
            if (type === 'error') {
                clearAllBtn.style.display = 'none'; // Hide for errors
            } else {
                clearAllBtn.style.display = 'inline-block'; // Show for success/info
            }
        }

        // Clear any existing timeout
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
            this.notificationTimeout = null;
        }

        // Auto-hide only for success and info, errors persist forever
        if (type === 'success' || type === 'info') {
            // Get notification duration from settings
            let duration = 15000; // Default 15 seconds
            try {
                const { ipcRenderer } = require('electron');
                const settings = await ipcRenderer.invoke('get-settings');
                duration = settings.notificationDuration || 15000;
            } catch (error) {
                console.error('Failed to get notification duration from settings:', error);
            }
            
            this.notificationTimeout = setTimeout(() => {
                const currentType = notification.className.split(' ').find(cls => 
                    ['success', 'info', 'error', 'warning'].includes(cls)
                );
                // Only auto-hide if still showing this notification (not replaced)
                if (currentType === type || currentType === 'success' || currentType === 'info') {
                    notification.classList.add('hidden');
                }
            }, duration);
        }
        // Errors don't auto-hide - user must manually close them
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

    showMainInterface(user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('main-interface').classList.remove('hidden');
        document.getElementById('user-name').textContent = user.username;
    }

    showLoginInterface() {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('main-interface').classList.add('hidden');
    }

    updateSessionStatus(status) {
        const statusElement = document.getElementById('session-status');
        statusElement.textContent = status;
        statusElement.className = `step-status ${status === 'active' ? 'active' : 'ready'}`;
    }

    showScreenshotPreview(screenshotData) {
        const preview = document.getElementById('screenshot-preview');
        const image = document.getElementById('screenshot-image');
        
        if (screenshotData && screenshotData.path) {
            // Load image from local file path
            image.src = `file://${screenshotData.path}`;
            preview.classList.remove('hidden');
        }
    }

    hideScreenshotPreview() {
        document.getElementById('screenshot-preview').classList.add('hidden');
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

        // Clear popup signal input and search
        signalInput.value = '';
        signalInput.dataset.value = '';
        
        // Clear signal dropdown and hide create signal form
        const signalDropdown = document.getElementById('popup-signal-dropdown');
        const createSignalSection = document.getElementById('create-signal-section');
        const showCreateSignalBtn = document.getElementById('show-create-signal-btn');
        
        if (signalDropdown) {
            signalDropdown.classList.add('hidden');
        }
        if (createSignalSection) {
            createSignalSection.classList.add('hidden');
        }
        if (showCreateSignalBtn) {
            showCreateSignalBtn.classList.remove('hidden');
        }

        // Show popup
        popup.classList.remove('hidden');
        
        // Focus on signal input and trigger load signals
        setTimeout(() => {
            signalInput.focus();
            // Trigger load signals with empty query to show all signals
            // Dispatch custom event to trigger signal loading
            const loadSignalsEvent = new CustomEvent('loadPopupSignals', {
                detail: { page: 1, query: '', isNewSearch: true }
            });
            document.dispatchEvent(loadSignalsEvent);
        }, 100);
    }

    hideScreenshotPopup() {
        const popup = document.getElementById('screenshot-popup');
        popup.classList.add('hidden');
    }

    // Upload Queue Management
    addToUploadQueue(signalId, url, bucketName, signalName = '', screenshotData, sessionData = null, userData = null) {
        // Check if session is still valid before adding to queue
        if (!screenshotData || !screenshotData.path) {
            this.showNotification('No screenshot available for upload', 'error');
            return null;
        }
        
        // Get sportId and assignedUserId from session and user data
        const sportId = sessionData?.sportId || null;
        const assignedUserId = userData?.id || null;
        
        if (!sportId || !assignedUserId) {
            this.showNotification('Missing session or user data. Please restart the app.', 'error');
            return null;
        }
        
        // Validate signalId is present
        if (!signalId) {
            this.showNotification('Please select a signal before uploading', 'error');
            return null;
        }
        
        const queueItem = {
            id: Date.now(),
            signalId,
            url,
            bucketName,
            signalName,
            sportId,
            assignedUserId,
            filePath: screenshotData.path,
            status: 'uploading',
            timestamp: new Date(),
            error: null,
            imageUrl: null
        };
        
        this.uploadQueue.unshift(queueItem); // Add to beginning
        this.updateQueueDisplay();
        this.showQueue();
        
        // Start background upload immediately (non-blocking)
        this.uploadScreenshotBackground(queueItem).catch(error => {
            console.error('Upload failed:', error);
        });
        
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

    clearUploadQueueExceptErrors() {
        // Only remove success and uploading items, keep errors
        const errorItems = this.uploadQueue.filter(item => item.status === 'error');
        const removedCount = this.uploadQueue.length - errorItems.length;
        
        this.uploadQueue = errorItems; // Keep only error items
        this.updateQueueDisplay();
        
        if (this.uploadQueue.length === 0) {
            this.hideQueue();
        }
        
        console.log(`🗑️ Cleared ${removedCount} items from queue (kept ${errorItems.length} error items)`);
        
        // Show notification
        if (removedCount > 0) {
            this.showNotification(`✅ Removed ${removedCount} item(s) from queue (${errorItems.length} error(s) kept)`, 'success');
        } else {
            this.showNotification('⚠️ No items to remove (only errors remain)', 'info');
        }
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
            if (!signalId || !sportId || !assignedUserId || !filePath) {
                queueItem.status = 'error';
                queueItem.error = 'Missing required data: signalId, sportId, assignedUserId, or filePath';
                this.updateQueueDisplay();
                this.showErrorPopupWithDetails(queueItem);
                return;
            }
            
            // Step 1: Check if URL already exists (required for accuracy)
            console.log('🔍 Checking URL existence:', { url, sportId });
            const { ipcRenderer } = require('electron');
            const urlCheckResult = await ipcRenderer.invoke('check-url-exists', { url, sportId });
            
            if (urlCheckResult.success && urlCheckResult.exists) {
                console.log('❌ URL already exists in database');
                queueItem.status = 'error';
                queueItem.error = 'URL already exists in database! Please navigate to a different URL and try again.';
                this.updateQueueDisplay();
                this.showErrorPopupWithDetails(queueItem);
                return;
            }
            
            console.log('✅ URL is new, proceeding with upload');
            
            // Step 2: Create detected link with signal_id
            console.log('🔗 Creating detected link for URL:', url);
            const linkResult = await ipcRenderer.invoke('create-detected-link', {
                url: url,
                sportId: sportId,
                signalId: signalId,
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
            
            // Step 3: Skip backup for speed (file already preserved in screenshots folder)
            console.log('📁 File already preserved in screenshots folder:', filePath);
            
            // Step 4: Upload screenshot
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
                this.showNotification(`✅ Screenshot uploaded successfully to folder: ${bucketName}!`, 'success');
                this.showNotification(`📁 Local file kept: ${filePath}`, 'info');
                console.log('✅ Upload completed successfully');
                console.log('📁 Original file preserved:', filePath);
                
                // Auto-minimize logic:
                // - If window was visible before screenshot → KEEP visible (user was using app normally)
                // - If window was hidden before screenshot (from tray) → MINIMIZE back to tray immediately
                if (!this.wasVisibleBeforeScreenshot) {
                    // User triggered from tray, minimize back after upload
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.invoke('minimize-to-tray').then(result => {
                        if (result && result.minimized) {
                            console.log('🔽 App minimized back to tray after upload (triggered from tray)');
                        }
                    });
                } else {
                    console.log('⏭️ Window was visible before, keeping it visible');
                }
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

    showSystemNotification() {
        // Create system notification
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
        // Flash window to get attention
        try {
            ipcRenderer.send('flash-window');
        } catch (e) {
            console.log('Could not flash window:', e);
        }
    }

    playErrorSound() {
        // Create error sound
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
            // Fallback: use system beep
            console.log('\a'); // ASCII bell character
        }
    }
}

module.exports = UiService;
