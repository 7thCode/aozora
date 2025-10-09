"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    downloadNovel: (url) => electron_1.ipcRenderer.invoke('download-novel', url),
    getMetadata: (url) => electron_1.ipcRenderer.invoke('get-metadata', url),
    fetchWorks: (options) => electron_1.ipcRenderer.invoke('fetch-works', options),
    clearCache: () => electron_1.ipcRenderer.invoke('clear-cache'),
    fetchCharCount: (url) => electron_1.ipcRenderer.invoke('fetch-char-count', url),
    onDownloadProgress: (callback) => {
        electron_1.ipcRenderer.on('download-progress', (_event, progress) => callback(progress));
    },
    getSavePath: () => electron_1.ipcRenderer.invoke('get-save-path'),
    selectSavePath: () => electron_1.ipcRenderer.invoke('select-save-path'),
    checkSavePath: (path) => electron_1.ipcRenderer.invoke('check-save-path', path)
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
