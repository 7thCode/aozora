import Store from 'electron-store';
import { app } from 'electron';
import * as path from 'path';

interface Settings {
  savePath: string;
  modelPath: string;
  modelsDirectory: string;
  hfToken: string;
}

const store: any = new Store<Settings>({
  defaults: {
    savePath: path.join(app.getPath('downloads'), 'aozora'),
    modelPath: '',
    modelsDirectory: path.join(app.getPath('userData'), 'models'),
    hfToken: '',
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