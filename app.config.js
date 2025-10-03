// Test Automation Screen Auto - Application Configuration
const isDev = process.argv.includes('--dev');

module.exports = {
  // API Configuration - Use production URLs by default
  apiBaseUrl: isDev ? 'http://127.0.0.1:8000/api/v1' : 'https://phanlaw-backend-app.greenwave-0b23b187.southeastasia.azurecontainerapps.io/api/v1',
  
  // Development/Production Mode
  nodeEnv: isDev ? 'development' : 'production',
  
  // Backend Server Configuration
  backendHost: isDev ? '127.0.0.1' : 'phanlaw-backend-app.greenwave-0b23b187.southeastasia.azurecontainerapps.io',
  backendPort: isDev ? 8000 : 443,
  
  // HTTP Server Configuration (for browser extension)
  httpServerPort: 3000,
  httpServerHost: 'localhost',
  
  // Screenshot Configuration
  screenshotSavePath: './screenshots',
  screenshotQuality: 90,
  
  // Logging Configuration
  logLevel: isDev ? 'debug' : 'info',
  logFile: './logs/app.log',
  
  // Production URLs
  production: {
    apiBaseUrl: 'https://phanlaw-backend-app.greenwave-0b23b187.southeastasia.azurecontainerapps.io/api/v1',
    backendHost: 'phanlaw-backend-app.greenwave-0b23b187.southeastasia.azurecontainerapps.io',
    backendPort: 443
  },
  
  // Development URLs
  development: {
    apiBaseUrl: 'http://127.0.0.1:8000/api/v1',
    backendHost: '127.0.0.1',
    backendPort: 8000
  }
};
