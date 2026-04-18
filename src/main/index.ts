import { app, BrowserWindow, Menu, protocol, net } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './ipc-handlers';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const dataDir = path.join(app.getPath('userData'));

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Disable default window zoom so ⌘+=/- can be used for waveform zoom
  mainWindow.webContents.setZoomFactor(1);
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mixcut-file',
    privileges: {
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        // Zoom In / Zoom Out intentionally omitted — ⌘+=/- used for waveform zoom
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]);
  Menu.setApplicationMenu(menu);

  protocol.handle('mixcut-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('mixcut-file://', ''));
    return net.fetch(`file://${filePath}`);
  });

  registerIpcHandlers(dataDir);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
