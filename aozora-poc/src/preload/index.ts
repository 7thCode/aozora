import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  downloadNovel: (url: string) => ipcRenderer.invoke('download-novel', url),
  onDownloadProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data));
  }
});
