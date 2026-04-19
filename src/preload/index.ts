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
  llmStatus: () => Promise<{ ready: boolean; modelPath: string | null }>;
  llmDispose: () => Promise<{ success: boolean }>;
  llmSummarizeWork: (cardUrl: string, maxChars?: number) => Promise<{ success: boolean; result?: string; error?: string }>;
  onLlmLoadProgress: (callback: (progress: number) => void) => void;
  onLlmToken: (callback: (token: string) => void) => void;
  // プロバイダー
  llmProviderGet: () => Promise<{ provider: string; model: string; ready: boolean }>;
  llmProviderSet: (provider: string, apiKey?: string, model?: string) => Promise<{ success: boolean; error?: string }>;
  llmProviderGetSavedKey: (provider: string) => Promise<string>;
  // モデルストア
  modelsGetPreset: () => Promise<any[]>;
  modelsList: () => Promise<{ models: any[] }>;
  modelsDelete: (modelId: string) => Promise<{ success: boolean }>;
  modelsDownloadStart: (modelConfig: any) => Promise<{ success: boolean; filePath?: string; downloadId?: string; error?: string }>;
  modelsDownloadCancel: (downloadId: string) => Promise<{ success: boolean }>;
  modelsHfSearch: (options: any) => Promise<{ success: boolean; models: any[] }>;
  modelsDirGet: () => Promise<{ success: boolean; path: string }>;
  modelsDirSelect: () => Promise<{ success: boolean; path?: string }>;
  modelsDirSet: (dirPath: string) => Promise<{ success: boolean }>;
  onModelsDownloadProgress: (callback: (data: any) => void) => void;
  onModelsDownloadComplete: (callback: (data: any) => void) => void;
  onModelsDownloadError: (callback: (data: any) => void) => void;
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
  llmStatus: () => ipcRenderer.invoke('llm:status'),
  llmDispose: () => ipcRenderer.invoke('llm:dispose'),
  llmSummarizeWork: (cardUrl: string, maxChars?: number) => ipcRenderer.invoke('llm:summarize-work', cardUrl, maxChars),
  onLlmLoadProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('llm:load-progress', (_event, progress) => callback(progress));
  },
  onLlmToken: (callback: (token: string) => void) => {
    ipcRenderer.on('llm:token', (_event, token) => callback(token));
  },
  // プロバイダー
  llmProviderGet: () => ipcRenderer.invoke('llm:provider-get'),
  llmProviderSet: (provider: string, apiKey?: string, model?: string) =>
    ipcRenderer.invoke('llm:provider-set', provider, apiKey, model),
  llmProviderGetSavedKey: (provider: string) => ipcRenderer.invoke('llm:provider-get-saved-key', provider),
  // モデルストア
  modelsGetPreset: () => ipcRenderer.invoke('models:get-preset'),
  modelsList: () => ipcRenderer.invoke('models:list'),
  modelsDelete: (modelId: string) => ipcRenderer.invoke('models:delete', modelId),
  modelsDownloadStart: (modelConfig: any) => ipcRenderer.invoke('models:download-start', modelConfig),
  modelsDownloadCancel: (downloadId: string) => ipcRenderer.invoke('models:download-cancel', downloadId),
  modelsHfSearch: (options: any) => ipcRenderer.invoke('models:hf-search', options),
  modelsDirGet: () => ipcRenderer.invoke('models:dir-get'),
  modelsDirSelect: () => ipcRenderer.invoke('models:dir-select'),
  modelsDirSet: (dirPath: string) => ipcRenderer.invoke('models:dir-set', dirPath),
  onModelsDownloadProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('download:progress', (_event, data) => callback(data));
  },
  onModelsDownloadComplete: (callback: (data: any) => void) => {
    ipcRenderer.on('download:complete', (_event, data) => callback(data));
  },
  onModelsDownloadError: (callback: (data: any) => void) => {
    ipcRenderer.on('download:error', (_event, data) => callback(data));
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
