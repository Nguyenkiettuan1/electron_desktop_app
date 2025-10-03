// API Service Module - Handles all API communications
const axios = require('axios');
const config = require('../../app.config');

class ApiService {
    constructor() {
        this.apiBaseUrl = config.apiBaseUrl;
        this.accessToken = null;
        this.currentUser = null;
    }

    setAccessToken(token, user) {
        this.accessToken = token;
        this.currentUser = user;
    }

    clearAuth() {
        this.accessToken = null;
        this.currentUser = null;
    }

    async login(credentials) {
        try {
            const formData = new URLSearchParams();
            formData.append('username', credentials.username);
            formData.append('password', credentials.password);
            
            const response = await axios.post(`${this.apiBaseUrl}/auth/login`, formData, {
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
    }

    async getCurrentUser() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/auth/me`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getRegions() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/regions?page_size=100`);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getSignals() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/signals?page_size=100`);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getSports(regionId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/sports?page_size=100&region_id=${regionId}`);
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async checkUrlExists(url) {
        try {
            console.log('🔍 Checking URL existence:', url);
            
            if (!this.accessToken) {
                console.log('No access token, skipping URL check');
                return { success: true, exists: false };
            }
            
            // Use search API to find exact URL match
            const response = await axios.get(`${this.apiBaseUrl}/detected_links?url=${encodeURIComponent(url)}&page_size=1`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data && response.data.data) {
                const existingUrls = response.data.data;
                console.log(`🔍 Found ${existingUrls.length} matching URLs`);
                
                // Check if any URL matches exactly
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
            return { success: true, exists: false };
        }
    }

    async createDetectedLink(url, sportId, assignedUserId) {
        try {
            console.log('🔗 Creating detected link:', { url, sportId, assignedUserId });
            const response = await axios.post(`${this.apiBaseUrl}/detected_links`, {
                url: url,
                sport_id: sportId,
                assigned_user_id: assignedUserId
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            console.log('✅ Detected link created successfully');
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error creating detected link:', error);
            return { success: false, error: error.message };
        }
    }

    async uploadScreenshot(filePath, detectedLinkId, bucketName = 'screenshots') {
        try {
            const FormData = require('form-data');
            const form = new FormData();
            
            // Add file
            form.append('file', require('fs').createReadStream(filePath));
            
            // Add other data
            form.append('detected_link_id', detectedLinkId);
            form.append('bucket_name', bucketName);
            
            const response = await axios.post(`${this.apiBaseUrl}/detected_link_images/upload`, form, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    ...form.getHeaders()
                }
            });
            
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = ApiService;
