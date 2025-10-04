import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

interface NovelMetadata {
  title: string;
  titleReading: string;
  author: string;
  authorReading: string;
  url: string;
  xhtmlUrl?: string;
  classification?: string;
}

export class AozoraDownloader {
  private outputDir: string;

  constructor(outputDir?: string) {
    // デフォルトはユーザーのDownloadsフォルダ内にaozoraディレクトリ作成
    this.outputDir = outputDir || path.join(homedir(), 'Downloads', 'aozora');
  }

  /**
   * 青空文庫作品をダウンロード
   */
  async download(cardUrl: string): Promise<string> {
    console.log(`\n📥 ダウンロード開始: ${cardUrl}`);

    // 1. メタデータ取得
    const metadata = await this.fetchMetadata(cardUrl);

    // 2. 本文取得
    if (!metadata.xhtmlUrl) {
      throw new Error('XHTML版URLが見つかりません');
    }

    const novelText = await this.fetchNovelText(metadata.xhtmlUrl);

    // 3. ファイル保存
    const filePath = await this.saveNovel(metadata, novelText);

    console.log(`\n✅ ダウンロード完了: ${filePath}`);
    return filePath;
  }

  /**
   * メタデータ取得
   */
  private async fetchMetadata(url: string): Promise<NovelMetadata> {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'AozoraCrawler-PoC/1.0' }
    });

    const $ = cheerio.load(response.data);
    const metadata: any = {};

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

    console.log(`📚 ${metadata.title} (${metadata.author})`);

    return metadata as NovelMetadata;
  }

  /**
   * 本文取得
   */
  private async fetchNovelText(xhtmlUrl: string): Promise<string> {
    const response = await axios.get(xhtmlUrl, {
      headers: { 'User-Agent': 'AozoraCrawler-PoC/1.0' },
      responseType: 'arraybuffer'
    });

    // Shift_JISデコード
    const decoder = new TextDecoder('shift_jis');
    const htmlText = decoder.decode(response.data);

    const $ = cheerio.load(htmlText);
    const mainText = $('.main_text').text().trim();

    console.log(`📄 本文取得完了: ${mainText.length}文字`);

    return mainText;
  }

  /**
   * ファイル保存
   */
  private async saveNovel(metadata: NovelMetadata, text: string): Promise<string> {
    // ディレクトリ: /作者名/
    const authorDir = path.join(this.outputDir, this.sanitizeFilename(metadata.author));
    await fs.mkdir(authorDir, { recursive: true });

    // ファイル名: 作品名.txt
    const filename = `${this.sanitizeFilename(metadata.title)}.txt`;
    const filePath = path.join(authorDir, filename);

    // メタデータヘッダー付きで保存
    const content = [
      `作品名: ${metadata.title}`,
      `作者: ${metadata.author}`,
      `出典: ${metadata.url}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      text
    ].join('\n');

    await fs.writeFile(filePath, content, 'utf-8');

    console.log(`💾 保存先: ${filePath}`);

    return filePath;
  }

  /**
   * ファイル名に使用できない文字を除去
   */
  private sanitizeFilename(name: string): string {
    return name.replace(/[<>:"\/\\|?*]/g, '_').trim();
  }
}

// CLI実行用
if (require.main === module) {
  const downloader = new AozoraDownloader();
  const testUrl = 'https://www.aozora.gr.jp/cards/000148/card789.html';

  downloader.download(testUrl)
    .then((filePath) => {
      console.log(`\n🎉 成功: ${filePath}`);
    })
    .catch((error) => {
      console.error('\n❌ エラー:', error);
    });
}
