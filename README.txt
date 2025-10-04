青空文庫クローラー - ビルド・起動方法
========================================

## プロジェクト概要

青空文庫の作品データを取得・管理するElectronアプリケーション

技術スタック:
- Electron (デスクトップアプリ)
- React + TypeScript (フロントエンド)
- Vite (ビルドツール)
- Cheerio (HTMLパース)
- Axios (HTTP通信)

## 必要な環境

- Node.js: v18以上推奨
- npm: v9以上推奨

## セットアップ手順

### 1. 依存関係のインストール

cd aozora-crawler
npm install

### 2. ビルド

npm run build

ビルド成果物: aozora-crawler/dist/

### 3. 開発モード起動

npm start

または

npm run dev

### 4. パッケージング (配布用)

npm run package

配布ファイル: aozora-crawler/release/

## 主な機能

1. 作品データの取得
   - 人気作家の作品を取得
   - 全作家の作品を取得（約1,300名）

2. 検索機能
   - 作品名での検索
   - 作家名でのインクリメンタル検索（オートコンプリート）

3. キャッシュ管理
   - 取得したデータを7日間キャッシュ
   - キャッシュのクリア機能

4. ダウンロード
   - 作品のテキストファイルをダウンロード
   - 進捗表示

## ディレクトリ構成

aozora-crawler/
├── src/
│   ├── main/           # メインプロセス (Electron)
│   │   ├── index.ts
│   │   ├── cache-manager.ts
│   │   ├── index-fetcher.ts
│   │   └── text-downloader.ts
│   ├── renderer/       # レンダラープロセス (React)
│   │   └── App.tsx
│   └── preload/        # プリロードスクリプト
│       └── index.ts
├── dist/               # ビルド出力 (gitignore)
├── release/            # パッケージ出力 (gitignore)
├── package.json
├── tsconfig.json
└── vite.config.ts

## 使い方

### アプリ起動後

1. 初回起動時
   - 「全作家取得」ボタンをクリック（時間がかかります）
   - または自動的に人気作家の作品が表示されます

2. 作家名で絞り込み
   - 「作家名で絞り込み...」欄に入力
   - 候補から選択してクリック
   - ×ボタンでクリア

3. 作品検索
   - 「作品名または作者名で検索...」欄に入力
   - リアルタイムでフィルタリング

4. ダウンロード
   - 作品の「ダウンロード」ボタンをクリック
   - テキストファイルが保存されます

## トラブルシューティング

### ビルドエラー

npm run clean
npm install
npm run build

### キャッシュが古い

アプリ内の「キャッシュクリア」機能を使用
または手動でキャッシュファイルを削除:
~/Library/Application Support/aozora-crawler/cache/

### 起動しない

1. Node.jsバージョン確認
   node --version

2. 依存関係の再インストール
   rm -rf node_modules package-lock.json
   npm install

## 開発者向け情報

### コマンド一覧

npm run dev          # 開発モード起動
npm run build        # プロダクションビルド
npm start            # ビルド→起動
npm run package      # 配布用パッケージ作成

### ホットリロード

開発モード (npm run dev) では自動的にホットリロードが有効

### デバッグ

開発者ツール: アプリ起動後に Cmd+Option+I (macOS) / Ctrl+Shift+I (Windows)

### ログ確認

コンソールログがターミナルに出力されます

## ライセンス・クレジット

データソース: 青空文庫 (https://www.aozora.gr.jp)
- 青空文庫の利用規約に従ってください

## 更新履歴

### 2025-10-04
- インクリメンタル検索機能を追加
- 作家名のオートコンプリート対応
- UIの使いやすさを改善
