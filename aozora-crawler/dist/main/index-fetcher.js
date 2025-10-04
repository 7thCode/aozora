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
exports.AozoraIndexFetcher = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
class AozoraIndexFetcher {
    /**
     * 作者別の作品一覧を取得
     * @param authorId 作者ID（例: '000148' = 夏目漱石）
     */
    async fetchAuthorWorks(authorId) {
        // authorIdの先頭ゼロを削除（例: '000148' → '148'）
        const numericId = parseInt(authorId, 10).toString();
        const url = `https://www.aozora.gr.jp/index_pages/person${numericId}.html`;
        const response = await axios_1.default.get(url, {
            headers: { 'User-Agent': 'AozoraCrawler/1.0' }
        });
        const $ = cheerio.load(response.data);
        const works = [];
        // 作者名を取得（tableから）
        const authorName = $('td.header:contains("作家名：")').next().text().trim();
        // 公開中の作品リストを解析
        $('ol li').each((_, element) => {
            const $li = $(element);
            const $link = $li.find('a');
            if ($link.length === 0)
                return;
            const title = $link.text().trim();
            const href = $link.attr('href');
            if (!href)
                return;
            // テキストから情報抽出
            const text = $li.text();
            // 作品ID抽出: "作品ID：1234"
            const idMatch = text.match(/作品ID[：:]\s*(\d+)/);
            const workId = idMatch ? idMatch[1] : '';
            // 文字種別抽出: "新字新仮名"など
            const typeMatch = text.match(/（([^）]+)、作品ID/);
            const textType = typeMatch ? typeMatch[1] : '';
            // 絶対URLに変換
            const cardUrl = `https://www.aozora.gr.jp/cards/${authorId}/${href.replace('../cards/' + authorId + '/', '')}`;
            works.push({
                id: workId,
                title,
                author: authorName,
                authorId,
                url: cardUrl,
                textType
            });
        });
        return works;
    }
    /**
     * 全作家のIDを取得
     */
    async fetchAllAuthorIds() {
        const url = 'https://www.aozora.gr.jp/index_pages/person_all.html';
        const response = await axios_1.default.get(url, {
            headers: { 'User-Agent': 'AozoraCrawler/1.0' }
        });
        const $ = cheerio.load(response.data);
        const authorIds = [];
        // person{数字}.htmlのリンクから作家IDを抽出
        $('a[href^="person"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
                const match = href.match(/person(\d+)\.html/);
                if (match) {
                    const id = match[1].padStart(6, '0'); // 6桁にゼロパディング
                    authorIds.push(id);
                }
            }
        });
        // 重複削除とソート
        return Array.from(new Set(authorIds)).sort();
    }
    /**
     * 人気作家の一覧を取得
     */
    async fetchPopularAuthors() {
        // 主要作家のID（青空文庫の人気作家）
        const popularAuthors = [
            { id: '000148', name: '夏目漱石' },
            { id: '000035', name: '太宰治' },
            { id: '000879', name: '芥川龍之介' },
            { id: '000081', name: '宮沢賢治' },
            { id: '000119', name: '中島敦' },
        ];
        return popularAuthors;
    }
    /**
     * 作品カードページから文字数を取得
     */
    async fetchCharCount(cardUrl) {
        try {
            const response = await axios_1.default.get(cardUrl, {
                headers: { 'User-Agent': 'AozoraCrawler/1.0' }
            });
            const $ = cheerio.load(response.data);
            // XHTMLファイルのリンクを探す
            const xhtmlLink = $('a[href$=".html"]').filter((_, el) => {
                const href = $(el).attr('href');
                return !!(href?.includes('/files/') && href?.includes('.html'));
            }).first().attr('href');
            if (!xhtmlLink)
                return undefined;
            // XHTMLファイルのURLを構築
            const baseUrl = cardUrl.substring(0, cardUrl.lastIndexOf('/'));
            const xhtmlUrl = `${baseUrl}/${xhtmlLink}`;
            // HEAD リクエストでファイルサイズを取得
            const headResponse = await axios_1.default.head(xhtmlUrl, {
                headers: { 'User-Agent': 'AozoraCrawler/1.0' }
            });
            const contentLength = headResponse.headers['content-length'];
            if (contentLength) {
                // Shift_JISは1文字2-3バイト程度なので、バイト数 / 2.5 で概算
                return Math.floor(parseInt(contentLength) / 2.5);
            }
        }
        catch (error) {
            // エラーは無視して undefined を返す
        }
        return undefined;
    }
    /**
     * 複数作者の作品を一括取得
     */
    async fetchMultipleAuthors(authorIds) {
        const allWorks = [];
        for (const authorId of authorIds) {
            try {
                const works = await this.fetchAuthorWorks(authorId);
                allWorks.push(...works);
            }
            catch (error) {
                console.error(`作者ID ${authorId} の取得失敗:`, error);
            }
        }
        return allWorks;
    }
    /**
     * 作品リストに文字数情報を追加
     */
    async enrichWithCharCounts(works, limit = 100) {
        console.log(`📊 文字数情報を取得中（最大${limit}件）...`);
        const enrichedWorks = [...works];
        const count = Math.min(limit, works.length);
        for (let i = 0; i < count; i++) {
            const charCount = await this.fetchCharCount(enrichedWorks[i].url);
            if (charCount) {
                enrichedWorks[i].charCount = charCount;
            }
            if ((i + 1) % 10 === 0) {
                console.log(`  ${i + 1}/${count} 件処理完了`);
            }
        }
        console.log(`✅ 文字数情報の取得完了`);
        return enrichedWorks;
    }
}
exports.AozoraIndexFetcher = AozoraIndexFetcher;
