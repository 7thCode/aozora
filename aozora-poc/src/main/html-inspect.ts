import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function inspectHTML() {
  const url = 'https://www.aozora.gr.jp/cards/000148/card789.html';

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'AozoraCrawler-PoC/1.0' }
  });

  // HTML全体を保存して確認
  fs.writeFileSync('aozora-sample.html', response.data);
  console.log('✅ HTML saved to aozora-sample.html');

  const $ = cheerio.load(response.data);

  // HTML構造をダンプ
  console.log('\n📋 HTML構造サンプル:');
  console.log('----------------------------------------');

  // headの内容
  console.log('📌 <head>:');
  console.log($('title').text());

  // bodyの主要要素
  console.log('\n📌 主要要素:');
  console.log('h1:', $('h1').text());
  console.log('h2:', $('h2').text());

  // クラス一覧
  console.log('\n📌 使用されているクラス:');
  $('[class]').each((i, elem) => {
    const className = $(elem).attr('class');
    if (i < 10) {  // 最初の10個のみ
      console.log(`  .${className}: ${$(elem).text().substring(0, 50)}`);
    }
  });

  // ID一覧
  console.log('\n📌 使用されているID:');
  $('[id]').each((i, elem) => {
    const id = $(elem).attr('id');
    console.log(`  #${id}: ${$(elem).text().substring(0, 50)}`);
  });
}

inspectHTML().catch(console.error);
