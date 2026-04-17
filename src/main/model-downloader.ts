import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BrowserWindow } from 'electron';

const execAsync = promisify(exec);

export interface ModelConfig {
  id: string;
  downloadUrl: string;
  size?: number;
}

interface DownloadState {
  id: string;
  modelId: string;
  status: 'downloading' | 'cancelled';
}

export class ModelDownloader {
  private win: BrowserWindow;
  private modelsDir: string;
  private hfToken: string;
  private activeDownloads: Map<string, DownloadState>;

  constructor(win: BrowserWindow, modelsDir: string, hfToken = '') {
    this.win = win;
    this.modelsDir = modelsDir;
    this.hfToken = hfToken;
    this.activeDownloads = new Map();
  }

  setModelsDirectory(newDir: string): void { this.modelsDir = newDir; }
  setHfToken(token: string): void { this.hfToken = token; }
  getModelsDirectory(): string { return this.modelsDir; }

  async downloadModel(modelConfig: ModelConfig): Promise<{ success: boolean; filePath: string; downloadId: string }> {
    const downloadId = crypto.randomUUID();
    const fileName = `${modelConfig.id}.gguf`;
    const tempPath = path.join(this.modelsDir, `${fileName}.part`);
    const finalPath = path.join(this.modelsDir, fileName);

    if (fs.existsSync(finalPath)) {
      throw new Error('Model already downloaded');
    }

    try {
      const freeSpace = await this.getFreeDiskSpace();
      const requiredSpace = (modelConfig.size || 0) * 1.2;
      if (requiredSpace > 0 && freeSpace < requiredSpace) {
        throw new Error(`ディスク容量不足: 必要 ${this.formatBytes(requiredSpace)}, 空き ${this.formatBytes(freeSpace)}`);
      }
    } catch (e: any) {
      if (e.message.startsWith('ディスク')) throw e;
      // 容量チェック失敗は無視して続行
    }

    const downloadState: DownloadState = { id: downloadId, modelId: modelConfig.id, status: 'downloading' };
    this.activeDownloads.set(downloadId, downloadState);

    try {
      return await this._performDownloadWithRetry(downloadId, modelConfig, tempPath, finalPath);
    } catch (error) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      this.activeDownloads.delete(downloadId);

      if (!this.win.isDestroyed()) {
        this.win.webContents.send('download:error', { downloadId, modelId: modelConfig.id, error: (error as Error).message });
      }
      throw error;
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async _performDownloadWithRetry(
    downloadId: string,
    modelConfig: ModelConfig,
    tempPath: string,
    finalPath: string,
    attempt = 0
  ): Promise<{ success: boolean; filePath: string; downloadId: string }> {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [5000, 15000, 30000];

    try {
      return await this._performDownload(downloadId, modelConfig, tempPath, finalPath);
    } catch (error: any) {
      const isRetryable = ['503', '429', 'timeout', 'ECONNRESET']
        .some((s) => error.message.includes(s));

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt] || 30000;
        if (!this.win.isDestroyed()) {
          this.win.webContents.send('download:retry', {
            downloadId, modelId: modelConfig.id,
            attempt: attempt + 1, maxRetries: MAX_RETRIES, delayMs: delay, reason: error.message,
          });
        }
        await this._sleep(delay);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return this._performDownloadWithRetry(downloadId, modelConfig, tempPath, finalPath, attempt + 1);
      }
      throw error;
    }
  }

  private _performDownload(
    downloadId: string,
    modelConfig: ModelConfig,
    tempPath: string,
    finalPath: string
  ): Promise<{ success: boolean; filePath: string; downloadId: string }> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(tempPath);
      let downloadedBytes = 0;
      let lastTime = Date.now();
      let lastBytes = 0;
      let totalBytes = 0;
      const downloadState = this.activeDownloads.get(downloadId)!;

      const requestOptions: https.RequestOptions = {
        timeout: 30000,
        headers: this.hfToken ? { Authorization: `Bearer ${this.hfToken}` } : {},
      };

      const request = https.get(modelConfig.downloadUrl, requestOptions, (response) => {
        if ([301, 302, 307, 308].includes(response.statusCode!)) {
          file.close();
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          const redirectUrl = response.headers.location;
          if (!redirectUrl) { reject(new Error(`Redirect but no Location header`)); return; }
          modelConfig.downloadUrl = redirectUrl;
          this._performDownload(downloadId, modelConfig, tempPath, finalPath).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }

        totalBytes = parseInt(response.headers['content-length'] || '0', 10);

        response.on('data', (chunk: Buffer) => {
          if (downloadState.status === 'cancelled') {
            request.destroy();
            file.close();
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            reject(new Error('Download cancelled by user'));
            return;
          }

          downloadedBytes += chunk.length;
          file.write(chunk);

          const now = Date.now();
          if (now - lastTime >= 1000) {
            const timeDelta = (now - lastTime) / 1000;
            const speed = (downloadedBytes - lastBytes) / timeDelta;
            const eta = speed > 0 ? (totalBytes - downloadedBytes) / speed : 0;
            const percentage = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
            if (!this.win.isDestroyed()) {
              this.win.webContents.send('download:progress', {
                downloadId, modelId: modelConfig.id,
                bytesDownloaded: downloadedBytes, totalBytes, percentage, speed, eta,
              });
            }
            lastTime = now;
            lastBytes = downloadedBytes;
          }
        });

        response.on('end', () => {
          file.end(() => {
            fs.renameSync(tempPath, finalPath);
            if (!this.win.isDestroyed()) {
              this.win.webContents.send('download:complete', { downloadId, modelId: modelConfig.id, filePath: finalPath });
            }
            this.activeDownloads.delete(downloadId);
            resolve({ success: true, filePath: finalPath, downloadId });
          });
        });

        response.on('error', (err) => {
          file.close();
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          reject(err);
        });
      });

      request.on('error', (err) => {
        file.close();
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        reject(err);
      });

      request.on('timeout', () => {
        request.destroy();
        file.close();
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        reject(new Error('Download timeout'));
      });
    });
  }

  cancelDownload(downloadId: string): { success: boolean; error?: string } {
    const state = this.activeDownloads.get(downloadId);
    if (state) { state.status = 'cancelled'; return { success: true }; }
    return { success: false, error: 'Download not found' };
  }

  listActiveDownloads() {
    return Array.from(this.activeDownloads.entries()).map(([id, state]) => ({
      downloadId: id, modelId: state.modelId, status: state.status,
    }));
  }

  private async getFreeDiskSpace(): Promise<number> {
    try {
      const { stdout } = await execAsync('df -k ~ | tail -1');
      const parts = stdout.trim().split(/\s+/);
      return parseInt(parts[3], 10) * 1024;
    } catch {
      return 50 * 1024 * 1024 * 1024;
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
