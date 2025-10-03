// URL Service Module - Handles URL detection and management
const { clipboard } = require('electron');
const { exec } = require('child_process');

class UrlService {
    constructor() {
        this.currentUrl = null;
    }

    setCurrentUrl(url) {
        this.currentUrl = url;
    }

    getCurrentUrl() {
        return this.currentUrl;
    }

    async detectUrlFromClipboard() {
        try {
            const clipboardText = clipboard.readText();
            
            if (clipboardText && (clipboardText.startsWith('http://') || clipboardText.startsWith('https://'))) {
                console.log('URL detected from clipboard:', clipboardText);
                this.currentUrl = clipboardText;
                return clipboardText;
            }
            
            return null;
        } catch (error) {
            console.error('Clipboard detection failed:', error);
            return null;
        }
    }

    async detectUrlFromBrowser() {
        try {
            const powershellScript = `
                Add-Type -AssemblyName System.Windows.Forms
                Add-Type -AssemblyName System.Drawing
                
                # Get active window
                $activeWindow = [System.Windows.Forms.Form]::ActiveForm
                if ($activeWindow -eq $null) {
                    # Try alternative method
                    $processes = Get-Process | Where-Object {$_.MainWindowTitle -ne ""}
                    $browserProcesses = $processes | Where-Object {
                        $_.ProcessName -match "chrome|edge|firefox|msedge" -or 
                        $_.MainWindowTitle -match "chrome|edge|firefox|microsoft"
                    }
                    
                    if ($browserProcesses) {
                        $browserProcesses[0].MainWindowTitle
                    }
                } else {
                    $activeWindow.Text
                }
            `;
            
            return new Promise((resolve, reject) => {
                exec(`powershell -Command "${powershellScript}"`, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    
                    const windowTitle = stdout.trim();
                    console.log('Active window title:', windowTitle);
                    
                    // Check if it's a browser
                    const browserIndicators = ['chrome', 'edge', 'firefox', 'microsoft'];
                    const isBrowser = browserIndicators.some(indicator => 
                        windowTitle.toLowerCase().includes(indicator)
                    );
                    
                    if (isBrowser) {
                        // Try to get URL using COM automation via PowerShell
                        this.getUrlFromBrowserViaPowerShell().then(resolve).catch(reject);
                    } else {
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('Browser detection failed:', error);
            return null;
        }
    }

    async getUrlFromBrowserViaPowerShell() {
        try {
            const powershellScript = `
                try {
                    # Try Chrome first
                    $chrome = New-Object -ComObject Chrome.Application
                    if ($chrome -and $chrome.Windows) {
                        $window = $chrome.Windows(0)
                        if ($window -and $window.ActiveTab) {
                            $url = $window.ActiveTab.Url
                            if ($url -and ($url.StartsWith("http://") -or $url.StartsWith("https://"))) {
                                Write-Output $url
                                exit 0
                            }
                        }
                    }
                } catch {
                    # Chrome failed, try Edge
                    try {
                        $edgeObjects = @("MicrosoftEdge.Application", "Edge.Application", "msedge.Application")
                        foreach ($edgeObj in $edgeObjects) {
                            try {
                                $edge = New-Object -ComObject $edgeObj
                                if ($edge -and $edge.Windows) {
                                    $window = $edge.Windows(0)
                                    if ($window -and $window.ActiveTab) {
                                        $url = $window.ActiveTab.Url
                                        if ($url -and ($url.StartsWith("http://") -or $url.StartsWith("https://"))) {
                                            Write-Output $url
                                            exit 0
                                        }
                                    }
                                }
                            } catch {
                                continue
                            }
                        }
                    } catch {
                        # All COM methods failed
                        Write-Output "NO_URL"
                    }
                }
            `;
            
            return new Promise((resolve, reject) => {
                exec(`powershell -Command "${powershellScript}"`, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    
                    const url = stdout.trim();
                    if (url && url !== 'NO_URL' && (url.startsWith('http://') || url.startsWith('https://'))) {
                        resolve(url);
                    } else {
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('PowerShell URL detection failed:', error);
            return null;
        }
    }

    async detectUrl() {
        try {
            console.log('Detecting URL...');
            
            // Method 1: Try to get URL from clipboard
            const clipboardUrl = await this.detectUrlFromClipboard();
            if (clipboardUrl) {
                this.currentUrl = clipboardUrl;
                return clipboardUrl;
            }
            
            // Method 2: Try to detect browser window and get URL using Windows API
            try {
                const browserUrl = await this.detectUrlFromBrowser();
                if (browserUrl) {
                    console.log('URL detected from browser:', browserUrl);
                    this.currentUrl = browserUrl;
                    return browserUrl;
                }
            } catch (error) {
                console.log('Browser detection failed:', error.message);
            }
            
            return null;
            
        } catch (error) {
            console.error('URL detection failed:', error);
            return null;
        }
    }
}

module.exports = UrlService;
