// Test Automation Screen Auto - Application Configuration
module.exports = {
  // API Configuration
  apiBaseUrl: process.env.API_BASE_URL || 'http://127.0.0.1:8000/api/v1',
  
  // Development/Production Mode
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Backend Server Configuration
  backendHost: process.env.BACKEND_HOST || '127.0.0.1',
  backendPort: process.env.BACKEND_PORT || 8000,
  
  // HTTP Server Configuration (for browser extension)
  httpServerPort: process.env.HTTP_SERVER_PORT || 3000,
  httpServerHost: process.env.HTTP_SERVER_HOST || 'localhost',
  
  // Screenshot Configuration
  screenshotSavePath: process.env.SCREENSHOT_SAVE_PATH || './screenshots',
  screenshotQuality: process.env.SCREENSHOT_QUALITY || 90,
  
  // Logging Configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE || './logs/app.log',
  
  // Production URLs
  production: {
    apiBaseUrl: 'https://api.testautomation-screenauto.com/api/v1',
    backendHost: 'api.testautomation-screenauto.com',
    backendPort: 443
  },
  
  // Development URLs
  development: {
    apiBaseUrl: 'http://127.0.0.1:8000/api/v1',
    backendHost: '127.0.0.1',
    backendPort: 8000
  }
};
