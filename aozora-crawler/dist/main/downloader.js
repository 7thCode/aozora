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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AozoraDownloader = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os_1 = require("os");
class AozoraDownloader {
    constructor(outputDir) {
        this.outputDir = outputDir || path.join((0, os_1.homedir)(), 'Downloads', 'aozora');
    }
    /**
     * 青空文庫作品をダウンロード
     * @param cardUrl 図書カードURL
     * @param onProgress 進捗コールバック
     */
    async download(cardUrl, onProgress) {
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
        }
        catch (error) {
            throw new Error(`ダウンロードエラー: ${error.message}`);
        }
    }
    /**
     * メタデータ取得
     */
    async fetchMetadata(url) {
        const response = await axios_1.default.get(url, {
            headers: { 'User-Agent': 'AozoraCrawler/1.0' }
        });
        const $ = cheerio.load(response.data);
        const metadata = { url };
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
        return metadata;
    }
    /**
     * 本文取得
     */
    async fetchNovelText(xhtmlUrl) {
        const response = await axios_1.default.get(xhtmlUrl, {
            headers: { 'User-Agent': 'AozoraCrawler/1.0' },
            responseType: 'arraybuffer'
        });
        const decoder = new TextDecoder('shift_jis');
        const htmlText = decoder.decode(response.data);
        const $ = cheerio.load(htmlText);
        const mainText = $('.main_text').text().trim();
        return mainText;
    }
    /**
     * ファイル保存
     */
    async saveNovel(metadata, text) {
        const authorDir = path.join(this.outputDir, this.sanitizeFilename(metadata.author));
        await fs.mkdir(authorDir, { recursive: true });
        const filename = `${this.sanitizeFilename(metadata.title)}.txt`;
        const filePath = path.join(authorDir, filename);
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
        return filePath;
    }
    sanitizeFilename(name) {
        return name.replace(/[<>:"\/\\|?*]/g, '_').trim();
    }
}
exports.AozoraDownloader = AozoraDownloader;
