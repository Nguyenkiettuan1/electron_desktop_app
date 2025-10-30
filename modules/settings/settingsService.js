// Settings Service Module - Handles app settings and keyboard shortcuts
const Store = require('electron-store');

class SettingsService {
    constructor() {
        this.store = new Store({
            name: 'app-settings',
            defaults: {
                shortcuts: {
                    takeScreenshot: 'CommandOrControl+Shift+Q',
                    uploadScreenshot: 'CommandOrControl+Shift+U',
                    cancelAction: 'Escape'
                },
                autoMinimizeAfterUpload: true,
                notificationDuration: 15000, // 15 seconds for success notifications
                checkUpdatesOnStartup: true
            }
        });
    }

    // Get all shortcuts
    getShortcuts() {
        return this.store.get('shortcuts');
    }

    // Get specific shortcut
    getShortcut(name) {
        return this.store.get(`shortcuts.${name}`);
    }

    // Set specific shortcut
    setShortcut(name, value) {
        this.store.set(`shortcuts.${name}`, value);
    }

    // Set all shortcuts
    setShortcuts(shortcuts) {
        this.store.set('shortcuts', shortcuts);
    }

    // Reset shortcuts to defaults
    resetShortcuts() {
        this.store.set('shortcuts', {
            takeScreenshot: 'CommandOrControl+Shift+Q',
            uploadScreenshot: 'CommandOrControl+Shift+U',
            cancelAction: 'Escape'
        });
    }

    // Get all settings
    getAllSettings() {
        return {
            shortcuts: this.getShortcuts(),
            autoMinimizeAfterUpload: this.store.get('autoMinimizeAfterUpload'),
            notificationDuration: this.store.get('notificationDuration'),
            checkUpdatesOnStartup: this.store.get('checkUpdatesOnStartup')
        };
    }

    // Set setting
    setSetting(key, value) {
        this.store.set(key, value);
    }

    // Get setting
    getSetting(key) {
        return this.store.get(key);
    }

    // Reset all settings to defaults
    resetAll() {
        this.store.clear();
    }
}

module.exports = SettingsService;


