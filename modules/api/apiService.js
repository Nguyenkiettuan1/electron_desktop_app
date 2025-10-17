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

    async getRegions(searchQuery = '', page = 1, pageSize = 10) {
        try {
            // Build query params
            let queryParams = `page=${page}&page_size=${pageSize}`;
            
            // Add search params if provided (search by region_name)
            if (searchQuery && searchQuery.trim()) {
                const search = encodeURIComponent(searchQuery.trim());
                queryParams += `&region_name=${search}`;
            }
            
            console.log('🌍 Fetching regions with params:', queryParams);
            const response = await axios.get(`${this.apiBaseUrl}/regions?${queryParams}`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error fetching regions:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    async getSignals(searchQuery = '', page = 1, pageSize = 10) {
        try {
            // Build query params
            let queryParams = `page=${page}&page_size=${pageSize}`;
            
            // Add search params if provided (search by signal_name)
            if (searchQuery && searchQuery.trim()) {
                const search = encodeURIComponent(searchQuery.trim());
                queryParams += `&signal_name=${search}`;
            }
            
            console.log('🔔 Fetching signals with params:', queryParams);
            const response = await axios.get(`${this.apiBaseUrl}/signals?${queryParams}`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error fetching signals:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    async getSports(regionId, searchQuery = '', page = 1, pageSize = 10) {
        try {
            // Build query params
            let queryParams = `page=${page}&page_size=${pageSize}&region_id=${regionId}`;
            
            // Add search params if provided
            // Note: Backend API only supports searching by league OR match_name separately
            // Here we search by league only (you can also try match_name if needed)
            if (searchQuery && searchQuery.trim()) {
                const search = encodeURIComponent(searchQuery.trim());
                queryParams += `&league=${search}`;
            }
            
            console.log('🏆 Fetching sports with params:', queryParams);
            const response = await axios.get(`${this.apiBaseUrl}/sports?${queryParams}`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error fetching sports:', error.response?.data || error.message);
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

    async createDetectedLink(url, sportId, signalId, assignedUserId) {
        try {
            console.log(' Creating detected link:', { url, sportId, signalId, assignedUserId });
            const response = await axios.post(`${this.apiBaseUrl}/detected_links`, {
                url: url,
                sport_id: sportId,
                signal_id: signalId,
                assigned_user_id: assignedUserId
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error creating detected link:', error.response?.data || error.message);
            return { 
                success: false, 
                error: error.response?.data?.detail || error.message 
            };
        }
    }

    async uploadScreenshot(filePath, detectedLinkId, bucketName = 'screenshots', provider = 'GOOGLE_CLOUD') {
        try {
            const FormData = require('form-data');
            const form = new FormData();
            
            form.append('file', require('fs').createReadStream(filePath));
            
            form.append('detected_link_id', detectedLinkId);
            form.append('bucket_name', bucketName);
            form.append('provider', provider);
            
            const response = await axios.post(`${this.apiBaseUrl}/detected_link_images/upload`, form, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    ...form.getHeaders()
                }
            });
            
            console.log('✅ Upload response:', response.data);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Upload error:', error.response?.data || error.message);
            return { 
                success: false, 
                error: error.response?.data?.detail || error.message 
            };
        }
    }

    async createSignal(signalData) {
        try {
            console.log('🔔 Creating new signal:', signalData);
            const response = await axios.post(`${this.apiBaseUrl}/signals`, signalData, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error creating signal:', error.response?.data || error.message);
            return { 
                success: false, 
                error: error.response?.data?.detail || error.message 
            };
        }
    }
}

module.exports = ApiService;
