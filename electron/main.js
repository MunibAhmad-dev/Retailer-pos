const { app, BrowserWindow } = require('electron');
const path = require('path');

// Check if we are in development mode
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload path:', preloadPath);
  console.log('Preload exists:', require('fs').existsSync(preloadPath));
  const win = new BrowserWindow({
    width: 1200, // Adjust as needed for your POS
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Security best practice
      contextIsolation: true, // Security best practice
    },
  });

  // Load the app
  if (isDev) {
    // In development, load from the Vite/React dev server
    win.loadURL('http://localhost:5173'); // Adjust port if yours is different (e.g., 3000 for CRA)
    win.webContents.openDevTools(); // Open DevTools for debugging
  } else {
    // In production, load the file from your dist folder
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});