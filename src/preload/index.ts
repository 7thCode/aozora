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
  // LLM
  llmGetModelPath: () => Promise<string>;
  llmSelectModel: () => Promise<{ success: boolean; path?: string }>;
  llmInit: (modelPath?: string) => Promise<{ success: boolean; error?: string }>;
  llmSummarize: (text: string) => Promise<{ success: boolean; result?: string; error?: string }>;
  llmStatus: () => Promise<{ ready: boolean; modelPath: string | null }>;
  llmDispose: () => Promise<{ success: boolean }>;
  llmSummarizeWork: (cardUrl: string) => Promise<{ success: boolean; result?: string; error?: string }>;
  onLlmLoadProgress: (callback: (progress: number) => void) => void;
  onLlmToken: (callback: (token: string) => void) => void;
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
  checkSavePath: (path: string) => ipcRenderer.invoke('check-save-path', path),
  // LLM
  llmGetModelPath: () => ipcRenderer.invoke('llm:get-model-path'),
  llmSelectModel: () => ipcRenderer.invoke('llm:select-model'),
  llmInit: (modelPath?: string) => ipcRenderer.invoke('llm:init', modelPath),
  llmSummarize: (text: string) => ipcRenderer.invoke('llm:summarize', text),
  llmStatus: () => ipcRenderer.invoke('llm:status'),
  llmDispose: () => ipcRenderer.invoke('llm:dispose'),
  llmSummarizeWork: (cardUrl: string) => ipcRenderer.invoke('llm:summarize-work', cardUrl),
  onLlmLoadProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('llm:load-progress', (_event, progress) => callback(progress));
  },
  onLlmToken: (callback: (token: string) => void) => {
    ipcRenderer.on('llm:token', (_event, token) => callback(token));
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
