import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  downloadNovel: (url: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  getMetadata: (url: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  fetchWorks: (options?: { all?: boolean; authorIds?: string[] }) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  clearCache: () => Promise<{ success: boolean; error?: string }>;
  fetchCharCount: (url: string) => Promise<{ success: boolean; charCount?: number; error?: string }>;
  fetchAccurateCharCount: (url: string) => Promise<{ success: boolean; charCount?: number; error?: string }>;
  onDownloadProgress: (callback: (progress: { stage: string; percent: number }) => void) => void;
  getSavePath: () => Promise<string>;
  selectSavePath: () => Promise<{ success: boolean; path?: string }>;
  checkSavePath: (path: string) => Promise<boolean>;
}

const electronAPI: ElectronAPI = {
  downloadNovel: (url: string) => ipcRenderer.invoke('download-novel', url),
  getMetadata: (url: string) => ipcRenderer.invoke('get-metadata', url),
  fetchWorks: (options?: { all?: boolean; authorIds?: string[] }) => ipcRenderer.invoke('fetch-works', options),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  fetchCharCount: (url: string) => ipcRenderer.invoke('fetch-char-count', url),
  fetchAccurateCharCount: (url: string) => ipcRenderer.invoke('fetch-accurate-char-count', url),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, progress) => callback(progress));
  },
  getSavePath: () => ipcRenderer.invoke('get-save-path'),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  checkSavePath: (path: string) => ipcRenderer.invoke('check-save-path', path)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
