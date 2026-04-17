import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AozoraDownloader } from './downloader';
import { AozoraIndexFetcher } from './index-fetcher';
import { CacheManager } from './cache-manager';
import { getSavePath, setSavePath, getModelPath, setModelPath, getModelsDirectory, setModelsDirectory, getHfToken } from './settings';
import { initializeLlm, summarize, isReady, getLoadedModelPath, disposeLlm } from './summarizer';
import { ModelManager } from './model-manager';
import { ModelDownloader } from './model-downloader';
import { searchHuggingFaceModels } from './hf-search';
import * as fsSync from 'fs';
import * as nodePath from 'path';

let mainWindow: BrowserWindow | null = null;
const downloader = new AozoraDownloader();
const indexFetcher = new AozoraIndexFetcher();
const cacheManager = new CacheManager();
let modelManager: ModelManager | null = null;
let modelDownloader: ModelDownloader | null = null;

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

app.whenReady().then(async () => {
  createWindow();
  const modelsDir = getModelsDirectory();
  modelManager = new ModelManager(modelsDir);
  await modelManager.initialize();
  modelDownloader = new ModelDownloader(mainWindow!, modelsDir, getHfToken());
});

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

// LLM関連
ipcMain.handle('llm:get-model-path', () => {
  return getModelPath();
});

ipcMain.handle('llm:select-model', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: 'GGUFモデルファイルを選択',
    buttonLabel: '選択',
    filters: [{ name: 'GGUF Model', extensions: ['gguf'] }]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const modelPath = result.filePaths[0];
    setModelPath(modelPath);
    return { success: true, path: modelPath };
  }
  return { success: false };
});

ipcMain.handle('llm:init', async (event, modelPath?: string) => {
  const targetPath = modelPath || getModelPath();
  if (!targetPath) return { success: false, error: 'モデルパスが設定されていません' };

  try {
    await initializeLlm(targetPath, (progress) => {
      event.sender.send('llm:load-progress', progress);
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('llm:summarize', async (event, text: string) => {
  try {
    let result = '';
    result = await summarize(text, (token) => {
      event.sender.send('llm:token', token);
    });
    return { success: true, result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('llm:status', () => {
  return { ready: isReady(), modelPath: getLoadedModelPath() };
});

ipcMain.handle('llm:dispose', async () => {
  await disposeLlm();
  return { success: true };
});

// ===== モデルストア =====
ipcMain.handle('models:get-preset', async () => {
  const jsonPath = nodePath.join(__dirname, '../../src/shared/preset-models.json');
  const raw = fsSync.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(raw).models;
});

ipcMain.handle('models:list', async () => {
  if (!modelManager) return { models: [] };
  const models = await modelManager.listModels();
  return { models };
});

ipcMain.handle('models:delete', async (_event, modelId: string) => {
  if (!modelManager) return { success: false };
  await modelManager.deleteModel(modelId);
  return { success: true };
});

ipcMain.handle('models:download-start', async (_event, modelConfig: any) => {
  if (!modelDownloader) return { success: false, error: '初期化中' };
  const result = await modelDownloader.downloadModel(modelConfig);
  return result;
});

ipcMain.handle('models:download-cancel', (_event, downloadId: string) => {
  if (!modelDownloader) return { success: false };
  return modelDownloader.cancelDownload(downloadId);
});

ipcMain.handle('models:hf-search', async (_event, options: any) => {
  const models = await searchHuggingFaceModels({ ...options, hfToken: getHfToken() });
  return { success: true, models };
});

ipcMain.handle('models:dir-get', () => {
  return { success: true, path: getModelsDirectory() };
});

ipcMain.handle('models:dir-select', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'モデル保存先を選択',
    buttonLabel: '選択',
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('models:dir-set', async (_event, dirPath: string) => {
  setModelsDirectory(dirPath);
  modelManager?.setModelsDirectory(dirPath);
  modelDownloader?.setModelsDirectory(dirPath);
  await modelManager?.initialize();
  return { success: true };
});

// ===== LLM 要約（作品テキスト）=====
ipcMain.handle('llm:summarize-work', async (event, cardUrl: string, maxChars = 300) => {
  try {
    const text = await downloader.fetchPlainText(cardUrl);
    let result = '';
    result = await summarize(text, (token) => {
      event.sender.send('llm:token', token);
    }, maxChars);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});
