const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;
function createWindow() {
    if (process.platform === 'darwin') {
        app.dock.setIcon(path.join(__dirname, 'focusRpgLogo.png'));
    }
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        icon: path.join(__dirname, 'focusRpgLogo.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            worldSafeExecuteJavaScript: true
        }
    });

    mainWindow.loadFile('index.html');
    
    // Open DevTools for troubleshooting
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});