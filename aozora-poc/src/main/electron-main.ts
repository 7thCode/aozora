import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { AozoraDownloader } from './downloader';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers
const downloader = new AozoraDownloader();

ipcMain.handle('download-novel', async (event, url: string) => {
  try {
    console.log('📥 IPC: ダウンロード開始', url);

    // 進捗通知（簡易実装）
    event.sender.send('download-progress', { status: 'starting', url });

    const filePath = await downloader.download(url);

    event.sender.send('download-progress', { status: 'completed', filePath });

    return { success: true, filePath };
  } catch (error) {
    console.error('❌ IPC: ダウンロードエラー', error);
    event.sender.send('download-progress', { status: 'error', error: (error as Error).message });

    return { success: false, error: (error as Error).message };
  }
});
