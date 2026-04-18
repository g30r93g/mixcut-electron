import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ProjectStore } from './project-store';
import { readPreferences, writePreferences } from './preferences';
import { cutTracks, CutTracksParams } from './processor';
import type { Preferences, ProjectState } from '../shared/types';

export function registerIpcHandlers(dataDir: string) {
  const projectStore = new ProjectStore(dataDir);

  // File picking
  ipcMain.handle('open-audio-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'M4A Audio', extensions: ['m4a'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    return { path: filePath, name: path.basename(filePath), size: stat.size };
  });

  ipcMain.handle('open-cue-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'CUE Sheet', extensions: ['cue'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    return { path: filePath, content };
  });

  ipcMain.handle('open-image-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    return { path: filePath, name: path.basename(filePath) };
  });

  ipcMain.handle('save-cue-file', async (_event, filePath: string, content: string) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('select-output-dir', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  // Processing
  ipcMain.handle('cut-tracks', async (event, params: CutTracksParams) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');
    await cutTracks(window, params);
  });

  // Output
  ipcMain.on('open-in-finder', (_event, dirPath: string) => {
    shell.openPath(dirPath);
  });

  // Projects
  ipcMain.handle('save-project', async (_event, project: ProjectState) => {
    await projectStore.save(project);
  });

  ipcMain.handle('load-project', async (_event, id: string) => {
    return projectStore.load(id);
  });

  ipcMain.handle('list-projects', async () => {
    return projectStore.list();
  });

  ipcMain.handle('delete-project', async (_event, id: string) => {
    await projectStore.delete(id);
  });

  // Preferences
  ipcMain.handle('get-preferences', async () => {
    return readPreferences(dataDir);
  });

  ipcMain.handle('set-preferences', async (_event, prefs: Partial<Preferences>) => {
    await writePreferences(dataDir, prefs);
  });
}
