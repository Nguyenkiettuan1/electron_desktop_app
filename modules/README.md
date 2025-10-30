# Modules Architecture

Cấu trúc modules được thiết kế để tách biệt các chức năng và dễ dàng bảo trì, mở rộng.

## Cấu trúc thư mục

```
modules/
├── api/
│   └── apiService.js          # Xử lý tất cả API calls
├── screenshot/
│   └── screenshotService.js   # Xử lý screenshot capture
├── url/
│   └── urlService.js          # Xử lý URL detection
├── ui/
│   └── uiService.js           # Xử lý UI operations và notifications
├── session/
│   └── sessionService.js      # Xử lý session management
├── http/
│   └── httpService.js         # Xử lý HTTP server cho browser extension
└── README.md                  # Tài liệu này
```

## Mô tả các modules

### 1. ApiService (`modules/api/apiService.js`)
- **Chức năng**: Xử lý tất cả API communications
- **Methods chính**:
  - `login(credentials)` - Đăng nhập
  - `getCurrentUser()` - Lấy thông tin user hiện tại
  - `getRegions()`, `getSignals()`, `getSports()` - Lấy dữ liệu
  - `checkUrlExists(url, sportId)` - Kiểm tra URL đã tồn tại trong sport cụ thể
  - `createDetectedLink()` - Tạo detected link
  - `uploadScreenshot()` - Upload screenshot

### 2. ScreenshotService (`modules/screenshot/screenshotService.js`)
- **Chức năng**: Xử lý tất cả screenshot operations
- **Methods chính**:
  - `captureScreenshot()` - Chụp screenshot
  - `preloadScreenshotSources()` - Preload sources để tăng tốc
  - `extractDomainFromUrl()` - Trích xuất domain từ URL
  - `setCurrentUser()` - Set user info cho filename generation

### 3. UrlService (`modules/url/urlService.js`)
- **Chức năng**: Xử lý URL detection và management
- **Methods chính**:
  - `detectUrl()` - Detect URL từ clipboard hoặc browser
  - `detectUrlFromClipboard()` - Detect từ clipboard
  - `detectUrlFromBrowser()` - Detect từ browser window
  - `setCurrentUrl()`, `getCurrentUrl()` - Quản lý current URL

### 4. UiService (`modules/ui/uiService.js`)
- **Chức năng**: Xử lý UI operations và notifications
- **Methods chính**:
  - `showNotification()`, `showLoading()`, `hideLoading()` - UI feedback
  - `showMainInterface()`, `showLoginInterface()` - Interface switching
  - `showScreenshotPreview()`, `showScreenshotPopup()` - Screenshot UI
  - `addToUploadQueue()` - Upload queue management
  - `updateQueueDisplay()` - Queue UI updates
  - `showErrorPopupWithDetails()` - Error handling UI

### 5. SessionService (`modules/session/sessionService.js`)
- **Chức năng**: Xử lý session management
- **Methods chính**:
  - `startSession(regionId, sportId, sportName)` - Bắt đầu session
  - `stopSession()` - Kết thúc session
  - `isSessionActive()` - Kiểm tra session active
  - `getSessionData()` - Lấy dữ liệu session
  - `resetSession()` - Reset session

### 6. HttpService (`modules/http/httpService.js`)
- **Chức năng**: Xử lý HTTP server cho browser extension communication
- **Methods chính**:
  - `startHttpServer()` - Khởi động HTTP server
  - `stopHttpServer()` - Dừng HTTP server
  - `handleUrlDetected()` - Xử lý URL từ extension
  - `handleRequestUrl()` - Xử lý request URL
  - `setMainWindow()` - Set main window reference

## Lợi ích của cấu trúc modules

### 1. **Separation of Concerns**
- Mỗi module có trách nhiệm riêng biệt
- Dễ dàng tìm và sửa lỗi
- Code dễ đọc và hiểu

### 2. **Maintainability**
- Thay đổi logic trong một module không ảnh hưởng đến modules khác
- Dễ dàng thêm tính năng mới
- Code được tổ chức rõ ràng

### 3. **Reusability**
- Các modules có thể được sử dụng lại
- Dễ dàng test từng module riêng biệt
- Có thể tạo unit tests cho từng module

### 4. **Scalability**
- Dễ dàng thêm modules mới
- Có thể tách nhỏ hơn nữa khi cần
- Hỗ trợ dependency injection

## Cách sử dụng

### Trong main.js:
```javascript
// Import modules
const ApiService = require('./modules/api/apiService');
const ScreenshotService = require('./modules/screenshot/screenshotService');

// Initialize services
this.apiService = new ApiService();
this.screenshotService = new ScreenshotService();

// Use services
const result = await this.apiService.login(credentials);
const screenshot = await this.screenshotService.captureScreenshot();
```

### Trong renderer.js:
```javascript
// Import modules
const UiService = require('./modules/ui/uiService');
const SessionService = require('./modules/session/sessionService');

// Initialize services
this.uiService = new UiService();
this.sessionService = new SessionService();

// Use services
this.uiService.showNotification('Success!', 'success');
const result = this.sessionService.startSession(regionId, sportId, sportName);
```

## Mở rộng trong tương lai

### 1. **Thêm modules mới**
- `modules/database/databaseService.js` - Xử lý database operations
- `modules/analytics/analyticsService.js` - Xử lý analytics
- `modules/notification/notificationService.js` - Xử lý notifications

### 2. **Cải thiện existing modules**
- Thêm caching cho ApiService
- Thêm compression cho ScreenshotService
- Thêm validation cho UrlService

### 3. **Dependency Injection**
- Tạo service container
- Inject dependencies vào modules
- Hỗ trợ testing tốt hơn

## Best Practices

1. **Single Responsibility**: Mỗi module chỉ có một trách nhiệm
2. **Dependency Injection**: Inject dependencies thay vì hard-code
3. **Error Handling**: Xử lý lỗi trong từng module
4. **Documentation**: Comment và document rõ ràng
5. **Testing**: Viết unit tests cho từng module
