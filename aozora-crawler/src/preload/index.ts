import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  downloadNovel: (url: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  getMetadata: (url: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  fetchWorks: (options?: { all?: boolean; authorIds?: string[] }) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  clearCache: () => Promise<{ success: boolean; error?: string }>;
  onDownloadProgress: (callback: (progress: { stage: string; percent: number }) => void) => void;
}

const electronAPI: ElectronAPI = {
  downloadNovel: (url: string) => ipcRenderer.invoke('download-novel', url),
  getMetadata: (url: string) => ipcRenderer.invoke('get-metadata', url),
  fetchWorks: (options?: { all?: boolean; authorIds?: string[] }) => ipcRenderer.invoke('fetch-works', options),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, progress) => callback(progress));
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
