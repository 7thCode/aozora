"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const downloader_1 = require("./downloader");
const index_fetcher_1 = require("./index-fetcher");
const cache_manager_1 = require("./cache-manager");
const settings_1 = require("./settings");
let mainWindow = null;
const downloader = new downloader_1.AozoraDownloader();
const indexFetcher = new index_fetcher_1.AozoraIndexFetcher();
const cacheManager = new cache_manager_1.CacheManager();
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// IPC Handlers
electron_1.ipcMain.handle('download-novel', async (event, url) => {
    try {
        const filePath = await downloader.download(url, (progress) => {
            event.sender.send('download-progress', progress);
        });
        return { success: true, filePath };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('get-metadata', async (_event, url) => {
    try {
        const metadata = await downloader.fetchMetadata(url);
        return { success: true, data: metadata };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// 単一作品の文字数取得（概算・高速）
electron_1.ipcMain.handle('fetch-char-count', async (_event, url) => {
    try {
        const charCount = await indexFetcher.fetchCharCount(url);
        return { success: true, charCount };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// 単一作品の正確な文字数取得
electron_1.ipcMain.handle('fetch-accurate-char-count', async (_event, url) => {
    try {
        const charCount = await indexFetcher.fetchAccurateCharCount(url);
        return { success: true, charCount };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// 作品一覧取得
electron_1.ipcMain.handle('fetch-works', async (_event, options) => {
    try {
        // キャッシュをチェック
        let works = await cacheManager.loadCache();
        if (!works || works.length === 0) {
            let ids;
            if (options?.all) {
                // 全作家取得
                console.log('📚 全作家の作品を取得中...');
                ids = await indexFetcher.fetchAllAuthorIds();
                console.log(`✅ ${ids.length}名の作家IDを取得しました`);
            }
            else {
                // 指定された作家または人気作家
                ids = options?.authorIds || ['000148', '000035', '000879', '000081', '000119'];
            }
            works = await indexFetcher.fetchMultipleAuthors(ids);
            // 文字数情報を追加（最初の200件）
            works = await indexFetcher.enrichWithCharCounts(works, 200);
            // キャッシュに保存
            await cacheManager.saveCache(works);
        }
        else {
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
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// キャッシュクリア
electron_1.ipcMain.handle('clear-cache', async () => {
    try {
        await cacheManager.clearCache();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// 保存先設定関連
electron_1.ipcMain.handle('get-save-path', () => {
    return (0, settings_1.getSavePath)();
});
electron_1.ipcMain.handle('select-save-path', async () => {
    const result = await electron_1.dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: '保存先フォルダを選択',
        buttonLabel: '選択'
    });
    if (!result.canceled && result.filePaths.length > 0) {
        (0, settings_1.setSavePath)(result.filePaths[0]);
        return { success: true, path: result.filePaths[0] };
    }
    return { success: false };
});
electron_1.ipcMain.handle('check-save-path', async (_event, checkPath) => {
    return fs.existsSync(checkPath);
});
