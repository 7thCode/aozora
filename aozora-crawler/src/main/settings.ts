import Store from 'electron-store';
import { app } from 'electron';
import * as path from 'path';

interface Settings {
  savePath: string;
}

const store: any = new Store<Settings>({
  defaults: {
    savePath: path.join(app.getPath('downloads'), 'aozora')
  }
});

export const getSavePath = (): string => {
  return store.get('savePath') as string;
};

export const setSavePath = (newPath: string): void => {
  store.set('savePath', newPath);
};