import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AozoraDownloader } from './downloader';
import { AozoraIndexFetcher } from './index-fetcher';
import { CacheManager } from './cache-manager';
import { getSavePath, setSavePath } from './settings';

let mainWindow: BrowserWindow | null = null;
const downloader = new AozoraDownloader();
const indexFetcher = new AozoraIndexFetcher();
const cacheManager = new CacheManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../../build/icon.png'),
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

// 単一作品の文字数取得（概算・高速）
ipcMain.handle('fetch-char-count', async (_event, url: string) => {
  try {
    const charCount = await indexFetcher.fetchCharCount(url);
    return { success: true, charCount };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 単一作品の正確な文字数取得
ipcMain.handle('fetch-accurate-char-count', async (_event, url: string) => {
  try {
    const charCount = await indexFetcher.fetchAccurateCharCount(url);
    return { success: true, charCount };
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
    } else {
      // キャッシュから読み込んだ場合でも、文字数が欠けている作品があれば補完
      const worksWithoutCharCount = works.filter(w => !w.charCount);
      if (worksWithoutCharCount.length > 0) {
        console.log(`📊 キャッシュに文字数情報がない作品を検出: ${worksWithoutCharCount.length}件`);
        const enrichedWorks = await indexFetcher.enrichWithCharCounts(worksWithoutCharCount, 200);
        
        // 文字数情報をマージ
        const charCountMap = new Map(enrichedWorks.map(w => [w.id, w.charCount]));
        works = works.map(w => ({
          ...w,
          charCount: w.charCount || charCountMap.get(w.id)
        }));
        
        // 更新されたキャッシュを保存
        await cacheManager.saveCache(works);
        console.log(`✅ 文字数情報を追加してキャッシュを更新しました`);
      }
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

// 保存先設定関連
ipcMain.handle('get-save-path', () => {
  return getSavePath();
});

ipcMain.handle('select-save-path', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: '保存先フォルダを選択',
    buttonLabel: '選択'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    setSavePath(result.filePaths[0]);
    return { success: true, path: result.filePaths[0] };
  }

  return { success: false };
});

ipcMain.handle('check-save-path', async (_event, checkPath: string) => {
  return fs.existsSync(checkPath);
});
