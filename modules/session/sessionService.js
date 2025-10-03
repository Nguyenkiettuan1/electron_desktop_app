// Session Service Module - Handles session management
class SessionService {
    constructor() {
        this.currentSession = null;
        this.currentUser = null;
    }

    setCurrentUser(user) {
        this.currentUser = user;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    startSession(regionId, sportId, sportName) {
        try {
            // Lock UI state (no API call needed)
            this.currentSession = { regionId, sportId, sportName };
            
            // Disable region and sport selects
            document.getElementById('region').disabled = true;
            document.getElementById('sport').disabled = true;
            document.getElementById('start-session-btn').disabled = true;
            
            // Show stop session button
            document.getElementById('stop-session-btn').classList.remove('hidden');
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
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
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getCurrentSession() {
        return this.currentSession;
    }

    isSessionActive() {
        return this.currentSession !== null;
    }

    getSessionData() {
        if (!this.currentSession) {
            return null;
        }

        return {
            regionId: this.currentSession.regionId,
            sportId: this.currentSession.sportId,
            sportName: this.currentSession.sportName,
            userId: this.currentUser?.id
        };
    }

    resetSession() {
        // Reset session data
        this.currentSession = null;
        
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
    }
}

module.exports = SessionService;
