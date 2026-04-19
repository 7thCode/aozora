import Store from 'electron-store';
import { app } from 'electron';
import * as path from 'path';

interface Settings {
  savePath: string;
  modelPath: string;
  modelsDirectory: string;
  hfToken: string;
  selectedProvider: string;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  geminiApiKey: string;
  geminiModel: string;
  temperature: number;
  maxTokens: number;
}

const store: any = new Store<Settings>({
  defaults: {
    savePath: path.join(app.getPath('downloads'), 'aozora'),
    modelPath: '',
    modelsDirectory: path.join(app.getPath('userData'), 'models'),
    hfToken: '',
    selectedProvider: 'local',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    anthropicApiKey: '',
    anthropicModel: 'claude-haiku-4-5-20251001',
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
    temperature: 0.3,
    maxTokens: 1024,
  }
});

export const getSavePath = (): string => {
  return store.get('savePath') as string;
};

export const setSavePath = (newPath: string): void => {
  store.set('savePath', newPath);
};

export const getModelPath = (): string => {
  return store.get('modelPath') as string;
};

export const setModelPath = (newPath: string): void => {
  store.set('modelPath', newPath);
};

export const getModelsDirectory = (): string => {
  return store.get('modelsDirectory') as string;
};

export const setModelsDirectory = (newPath: string): void => {
  store.set('modelsDirectory', newPath);
};

export const getHfToken = (): string => {
  return store.get('hfToken') as string;
};

export const setHfToken = (token: string): void => {
  store.set('hfToken', token);
};

export const getSelectedProvider = (): string => store.get('selectedProvider') as string;
export const setSelectedProvider = (p: string): void => { store.set('selectedProvider', p); };

export const getOpenaiApiKey = (): string => store.get('openaiApiKey') as string;
export const setOpenaiApiKey = (k: string): void => { store.set('openaiApiKey', k); };
export const getOpenaiModel = (): string => store.get('openaiModel') as string;
export const setOpenaiModel = (m: string): void => { store.set('openaiModel', m); };

export const getAnthropicApiKey = (): string => store.get('anthropicApiKey') as string;
export const setAnthropicApiKey = (k: string): void => { store.set('anthropicApiKey', k); };
export const getAnthropicModel = (): string => store.get('anthropicModel') as string;
export const setAnthropicModel = (m: string): void => { store.set('anthropicModel', m); };

export const getGeminiApiKey = (): string => store.get('geminiApiKey') as string;
export const setGeminiApiKey = (k: string): void => { store.set('geminiApiKey', k); };
export const getGeminiModel = (): string => store.get('geminiModel') as string;
export const setGeminiModel = (m: string): void => { store.set('geminiModel', m); };

export const getTemperature = (): number => store.get('temperature') as number;
export const setTemperature = (v: number): void => { store.set('temperature', v); };
export const getMaxTokens = (): number => store.get('maxTokens') as number;
export const setMaxTokens = (v: number): void => { store.set('maxTokens', v); };