import { contextBridge, ipcRenderer } from 'electron';
import type {
  CutProgress,
  DownloadProgress,
  Preferences,
  ProjectState,
  ProjectSummary,
} from '../shared/types';
import type { CutTracksParams } from '../main/processor';

const api = {
  // File picking
  openAudioFile: (): Promise<{ path: string; name: string; size: number } | null> =>
    ipcRenderer.invoke('open-audio-file'),
  openCueFile: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke('open-cue-file'),
  openImageFile: (): Promise<{ path: string; name: string } | null> =>
    ipcRenderer.invoke('open-image-file'),
  saveCueFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('save-cue-file', filePath, content),
  selectOutputDir: (): Promise<string | null> =>
    ipcRenderer.invoke('select-output-dir'),

  // Audio — serve file to renderer via custom protocol
  getAudioUrl: (filePath: string): string =>
    `mixcut-file://${encodeURIComponent(filePath)}`,
  getImageUrl: (filePath: string): string =>
    `mixcut-file://${encodeURIComponent(filePath)}`,

  // Processing
  cutTracks: (params: CutTracksParams): Promise<void> =>
    ipcRenderer.invoke('cut-tracks', params),
  onCutProgress: (callback: (progress: CutProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: CutProgress) =>
      callback(progress);
    ipcRenderer.on('cut-progress', handler);
    return () => ipcRenderer.removeListener('cut-progress', handler);
  },

  // Download
  downloadAudio: (url: string): Promise<{ path: string; name: string; metadata: { title?: string; artist?: string } }> =>
    ipcRenderer.invoke('download-audio', url),
  onDownloadProgress: (callback: (progress: DownloadProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) =>
      callback(progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  cancelDownload: (): void =>
    ipcRenderer.send('cancel-download'),

  // Output
  openInFinder: (dirPath: string): void =>
    ipcRenderer.send('open-in-finder', dirPath),

  // Projects
  saveProject: (project: ProjectState): Promise<void> =>
    ipcRenderer.invoke('save-project', project),
  loadProject: (id: string): Promise<ProjectState | null> =>
    ipcRenderer.invoke('load-project', id),
  listProjects: (): Promise<ProjectSummary[]> =>
    ipcRenderer.invoke('list-projects'),
  deleteProject: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-project', id),

  // Preferences
  getPreferences: (): Promise<Preferences> =>
    ipcRenderer.invoke('get-preferences'),
  setPreferences: (prefs: Partial<Preferences>): Promise<void> =>
    ipcRenderer.invoke('set-preferences', prefs),
};

export type MixcutApi = typeof api;

contextBridge.exposeInMainWorld('mixcut', api);
