import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { WorkItem } from './index-fetcher';

interface CacheData {
  version: string;
  lastUpdated: string;
  works: WorkItem[];
}

export class CacheManager {
  private cacheDir: string;
  private cacheFile: string;
  private readonly CACHE_VERSION = '1.0';
  private readonly CACHE_EXPIRY_DAYS = 7;

  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'cache');
    this.cacheFile = path.join(this.cacheDir, 'works-cache.json');
  }

  /**
   * キャッシュディレクトリを初期化
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * キャッシュを保存
   */
  async saveCache(works: WorkItem[]): Promise<void> {
    await this.ensureCacheDir();

    const cacheData: CacheData = {
      version: this.CACHE_VERSION,
      lastUpdated: new Date().toISOString(),
      works
    };

    await fs.writeFile(
      this.cacheFile,
      JSON.stringify(cacheData, null, 2),
      'utf-8'
    );

    console.log(`✅ キャッシュ保存完了: ${works.length}件`);
  }

  /**
   * キャッシュを読み込み
   */
  async loadCache(): Promise<WorkItem[] | null> {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf-8');
      const cacheData: CacheData = JSON.parse(data);

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
    } catch (error) {
      console.log('⚠️ キャッシュファイルが存在しません');
      return null;
    }
  }

  /**
   * キャッシュをクリア
   */
  async clearCache(): Promise<void> {
    try {
      await fs.unlink(this.cacheFile);
      console.log('✅ キャッシュ削除完了');
    } catch (error) {
      console.log('⚠️ キャッシュファイルが存在しません');
    }
  }

  /**
   * キャッシュの状態を取得
   */
  async getCacheInfo(): Promise<{
    exists: boolean;
    lastUpdated?: string;
    workCount?: number;
    isExpired?: boolean;
  }> {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf-8');
      const cacheData: CacheData = JSON.parse(data);

      const lastUpdated = new Date(cacheData.lastUpdated);
      const now = new Date();
      const daysDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

      return {
        exists: true,
        lastUpdated: cacheData.lastUpdated,
        workCount: cacheData.works.length,
        isExpired: daysDiff > this.CACHE_EXPIRY_DAYS
      };
    } catch {
      return { exists: false };
    }
  }
}
