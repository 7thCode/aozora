import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { AozoraDownloader } from './downloader';
import { AozoraIndexFetcher } from './index-fetcher';
import { CacheManager } from './cache-manager';

let mainWindow: BrowserWindow | null = null;
const downloader = new AozoraDownloader();
const indexFetcher = new AozoraIndexFetcher();
const cacheManager = new CacheManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  // �z��goVite����,j��go���ա��
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

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
ipcMain.handle('download-novel', async (event, url: string) => {
  try {
    const filePath = await downloader.download(url, (progress) => {
      event.sender.send('download-progress', progress);
    });

    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-metadata', async (_event, url: string) => {
  try {
    const metadata = await downloader.fetchMetadata(url);
    return { success: true, data: metadata };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 作品一覧取得
ipcMain.handle('fetch-works', async (_event, options?: { all?: boolean; authorIds?: string[] }) => {
  try {
    // キャッシュをチェック
    let works = await cacheManager.loadCache();

    if (!works || works.length === 0) {
      let ids: string[];

      if (options?.all) {
        // 全作家取得
        console.log('📚 全作家の作品を取得中...');
        ids = await indexFetcher.fetchAllAuthorIds();
        console.log(`✅ ${ids.length}名の作家IDを取得しました`);
      } else {
        // 指定された作家または人気作家
        ids = options?.authorIds || ['000148', '000035', '000879', '000081', '000119'];
      }

      works = await indexFetcher.fetchMultipleAuthors(ids);

      // 文字数情報を追加（最初の200件）
      works = await indexFetcher.enrichWithCharCounts(works, 200);

      // キャッシュに保存
      await cacheManager.saveCache(works);
    }

    return { success: true, data: works };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// キャッシュクリア
ipcMain.handle('clear-cache', async () => {
  try {
    await cacheManager.clearCache();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});
