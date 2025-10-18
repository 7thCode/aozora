import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getSavePath } from './settings';

export interface NovelMetadata {
  id: string;
  title: string;
  titleReading: string;
  author: string;
  authorReading: string;
  url: string;
  xhtmlUrl?: string;
  classification?: string;
}

export class AozoraDownloader {
  constructor() {
    // 保存先は設定から動的に取得
  }

  /**
   * 青空文庫作品をダウンロード
   * @param cardUrl 図書カードURL
   * @param onProgress 進捗コールバック
   */
  async download(
    cardUrl: string,
    onProgress?: (progress: { stage: string; percent: number }) => void
  ): Promise<string> {
    try {
      onProgress?.({ stage: 'メタデータ取得中', percent: 10 });
      const metadata = await this.fetchMetadata(cardUrl);

      if (!metadata.xhtmlUrl) {
        throw new Error('XHTML版URLが見つかりません');
      }

      onProgress?.({ stage: '本文ダウンロード中', percent: 40 });
      const novelText = await this.fetchNovelText(metadata.xhtmlUrl);

      onProgress?.({ stage: 'ファイル保存中', percent: 80 });
      const filePath = await this.saveNovel(metadata, novelText);

      onProgress?.({ stage: '完了', percent: 100 });
      return filePath;
    } catch (error) {
      throw new Error(`ダウンロードエラー: ${(error as Error).message}`);
    }
  }

  /**
   * メタデータ取得
   */
  async fetchMetadata(url: string): Promise<NovelMetadata> {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'AozoraCrawler/1.0' }
    });

    const $ = cheerio.load(response.data);
    const metadata: any = { url };

    $('table tr').each((_, row) => {
      const header = $(row).find('td.header').text().replace('：', '').trim();
      const value = $(row).find('td').last().text().trim();

      switch (header) {
        case '作品名':
          metadata.title = value;
          break;
        case '作品名読み':
          metadata.titleReading = value;
          break;
        case '著者名':
          metadata.author = $(row).find('a').text().trim();
          break;
        case '作家名読み':
          metadata.authorReading = value;
          break;
        case '分類':
          if (!metadata.classification) {
            metadata.classification = value;
          }
          break;
      }
    });

    // XHTML版URL取得
    const xhtmlLink = $('a').filter((_, el) => $(el).text().includes('XHTML版で読む')).attr('href');
    if (xhtmlLink) {
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      metadata.xhtmlUrl = baseUrl + xhtmlLink;
    }

    // IDを生成（URLから抽出）
    const idMatch = url.match(/card(\d+)\.html/);
    metadata.id = idMatch ? idMatch[1] : Date.now().toString();

    return metadata as NovelMetadata;
  }

  /**
   * 本文取得
   */
  /**
   * XHTML本文取得（そのまま保存）
   */
  private async fetchNovelText(xhtmlUrl: string): Promise<string> {
    const response = await axios.get(xhtmlUrl, {
      headers: { 'User-Agent': 'AozoraCrawler/1.0' },
      responseType: 'arraybuffer'
    });

    const decoder = new TextDecoder('shift_jis');
    const htmlText = decoder.decode(response.data);

    return htmlText;
  }

  /**
   * ファイル保存
   */
  /**
   * XHTML形式でファイル保存
   */
  /**
   * XHTML形式でファイル保存
   */
  private async saveNovel(metadata: NovelMetadata, htmlContent: string): Promise<string> {
    const basePath = getSavePath();
    const authorDir = path.join(basePath, this.sanitizeFilename(metadata.author));
    await fs.mkdir(authorDir, { recursive: true });

    const filename = `${this.sanitizeFilename(metadata.title)}.html`;
    const filePath = await this.getUniqueFilePath(authorDir, filename);

    await fs.writeFile(filePath, htmlContent, 'utf-8');

    return filePath;
  }

  /**
   * 重複ファイル名の処理（番号付与）
   */
  private async getUniqueFilePath(dir: string, filename: string): Promise<string> {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let filePath = path.join(dir, filename);
    let counter = 1;

    try {
      while (await fs.access(filePath).then(() => true).catch(() => false)) {
        filePath = path.join(dir, `${base}_${counter}${ext}`);
        counter++;
      }
    } catch {
      // ファイルが存在しない場合はそのまま
    }

    return filePath;
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[<>:"\/\\|?*]/g, '_').trim();
  }
}
