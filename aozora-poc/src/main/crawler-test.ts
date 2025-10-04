import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * 青空文庫HTML構造調査スクリプト（修正版）
 * 実際のHTML構造に基づいた抽出ロジック
 */

interface NovelMetadata {
  title: string;
  titleReading: string;
  author: string;
  authorReading: string;
  url: string;
  xhtmlUrl?: string;
  classification?: string;
}

async function fetchAozoraPage(url: string) {
  try {
    console.log(`📡 Fetching: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'AozoraCrawler-PoC/1.0'
      }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Fetch error:', error);
    throw error;
  }
}

async function extractMetadata(html: string, url: string): Promise<NovelMetadata> {
  const $ = cheerio.load(html);

  // テーブルから情報を抽出
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
        // リンクテキストのみ抽出
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

  // XHTML版URLを抽出
  const xhtmlLink = $('a').filter((_, el) => $(el).text().includes('XHTML版で読む')).attr('href');
  if (xhtmlLink) {
    // 相対パスを絶対パスに変換
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    metadata.xhtmlUrl = baseUrl + xhtmlLink;
  }

  console.log('\n📚 メタデータ抽出結果:');
  console.log(`  作品名: ${metadata.title}`);
  console.log(`  読み: ${metadata.titleReading}`);
  console.log(`  作者: ${metadata.author}`);
  console.log(`  作者読み: ${metadata.authorReading}`);
  console.log(`  分類: ${metadata.classification}`);
  console.log(`  XHTML版URL: ${metadata.xhtmlUrl}`);

  return {
    title: metadata.title || 'タイトル不明',
    titleReading: metadata.titleReading || '',
    author: metadata.author || '作者不明',
    authorReading: metadata.authorReading || '',
    url,
    xhtmlUrl: metadata.xhtmlUrl,
    classification: metadata.classification
  };
}

async function extractNovelTextFromXHTML(xhtmlUrl: string): Promise<string> {
  console.log(`\n📄 本文取得: ${xhtmlUrl}`);

  const response = await axios.get(xhtmlUrl, {
    headers: { 'User-Agent': 'AozoraCrawler-PoC/1.0' },
    responseType: 'arraybuffer'
  });

  // Shift_JISをUTF-8にデコード
  const decoder = new TextDecoder('shift_jis');
  const htmlText = decoder.decode(response.data);

  const $ = cheerio.load(htmlText);

  // XHTML版の本文は <div class="main_text"> 内にある
  const mainText = $('.main_text').text().trim();

  console.log(`  文字数: ${mainText.length}文字`);
  console.log(`  冒頭: ${mainText.substring(0, 150)}...`);

  return mainText;
}

// テスト実行
async function main() {
  console.log('🚀 青空文庫 PoC - HTML構造調査（修正版）\n');

  // テスト用URL（夏目漱石「吾輩は猫である」）
  const testUrl = 'https://www.aozora.gr.jp/cards/000148/card789.html';

  try {
    // 1. メタデータページの解析
    const html = await fetchAozoraPage(testUrl);
    const metadata = await extractMetadata(html, testUrl);

    // 2. XHTML版から本文取得
    if (metadata.xhtmlUrl) {
      const novelText = await extractNovelTextFromXHTML(metadata.xhtmlUrl);

      console.log('\n✅ 検証完了:');
      console.log(`  ✓ メタデータ抽出成功`);
      console.log(`  ✓ 本文取得成功 (${novelText.length}文字)`);
      console.log(`\n📁 保存可能なデータ:`);
      console.log(`  ファイル名: ${metadata.author}/${metadata.title}.txt`);
    } else {
      console.log('\n⚠️ XHTML版URLが見つかりませんでした');
    }
  } catch (error) {
    console.error('\n❌ 検証失敗:', error);
  }
}

main();
