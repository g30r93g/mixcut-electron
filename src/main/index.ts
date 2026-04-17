import { app, BrowserWindow, protocol, net } from 'electron';
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

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.meta && (input.key === '=' || input.key === '+' || input.key === '-')) {
      _event.preventDefault();
    }
  });

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
