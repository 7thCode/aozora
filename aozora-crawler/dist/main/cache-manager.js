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
exports.CacheManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const settings_1 = require("./settings");
class CacheManager {
    constructor() {
        this.CACHE_VERSION = '1.0';
        this.CACHE_EXPIRY_DAYS = 7;
        this.cacheDir = path.join((0, settings_1.getSavePath)(), 'cache');
        this.cacheFile = path.join(this.cacheDir, 'works-cache.json');
    }
    /**
     * キャッシュディレクトリを初期化
     */
    async ensureCacheDir() {
        try {
            await fs.access(this.cacheDir);
        }
        catch {
            await fs.mkdir(this.cacheDir, { recursive: true });
        }
    }
    /**
     * キャッシュを保存
     */
    async saveCache(works) {
        await this.ensureCacheDir();
        const cacheData = {
            version: this.CACHE_VERSION,
            lastUpdated: new Date().toISOString(),
            works
        };
        await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8');
        console.log(`✅ キャッシュ保存完了: ${works.length}件`);
    }
    /**
     * キャッシュを読み込み
     */
    async loadCache() {
        try {
            const data = await fs.readFile(this.cacheFile, 'utf-8');
            const cacheData = JSON.parse(data);
            // バージョンチェック
            if (cacheData.version !== this.CACHE_VERSION) {
                console.log('⚠️ キャッシュバージョン不一致、再取得が必要');
                return null;
            }
            // 有効期限チェック
            const lastUpdated = new Date(cacheData.lastUpdated);
            const now = new Date();
            const daysDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff > this.CACHE_EXPIRY_DAYS) {
                console.log('⚠️ キャッシュ期限切れ、再取得が必要');
                return null;
            }
            console.log(`✅ キャッシュ読み込み成功: ${cacheData.works.length}件`);
            return cacheData.works;
        }
        catch (error) {
            console.log('⚠️ キャッシュファイルが存在しません');
            return null;
        }
    }
    /**
     * キャッシュをクリア
     */
    async clearCache() {
        try {
            await fs.unlink(this.cacheFile);
            console.log('✅ キャッシュ削除完了');
        }
        catch (error) {
            console.log('⚠️ キャッシュファイルが存在しません');
        }
    }
    /**
     * キャッシュの状態を取得
     */
    async getCacheInfo() {
        try {
            const data = await fs.readFile(this.cacheFile, 'utf-8');
            const cacheData = JSON.parse(data);
            const lastUpdated = new Date(cacheData.lastUpdated);
            const now = new Date();
            const daysDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
            return {
                exists: true,
                lastUpdated: cacheData.lastUpdated,
                workCount: cacheData.works.length,
                isExpired: daysDiff > this.CACHE_EXPIRY_DAYS
            };
        }
        catch {
            return { exists: false };
        }
    }
}
exports.CacheManager = CacheManager;
