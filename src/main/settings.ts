import Store from 'electron-store';
import { app } from 'electron';
import * as path from 'path';

interface Settings {
  savePath: string;
  modelPath: string;
}

const store: any = new Store<Settings>({
  defaults: {
    savePath: path.join(app.getPath('downloads'), 'aozora'),
    modelPath: ''
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