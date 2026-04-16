import { useState, useEffect } from 'react';

interface WorkItem {
  id: string;
  title: string;
  author: string;
  url: string;
  textType: string;
  charCount?: number;
}

declare global {
  interface Window {
    electronAPI: {
      downloadNovel: (url: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      fetchWorks: (options?: { all?: boolean; authorIds?: string[] }) => Promise<{ success: boolean; data?: WorkItem[]; error?: string }>;
      clearCache: () => Promise<{ success: boolean; error?: string }>;
      fetchCharCount: (url: string) => Promise<{ success: boolean; charCount?: number; error?: string }>;
      fetchAccurateCharCount: (url: string) => Promise<{ success: boolean; charCount?: number; error?: string }>;
      onDownloadProgress: (callback: (progress: { stage: string; percent: number }) => void) => void;
      getSavePath: () => Promise<string>;
      selectSavePath: () => Promise<{ success: boolean; path?: string }>;
      checkSavePath: (path: string) => Promise<boolean>;
      llmStatus: () => Promise<{ ready: boolean; modelPath: string | null }>;
      llmInit: (modelPath?: string) => Promise<{ success: boolean; error?: string }>;
      llmSummarizeWork: (cardUrl: string) => Promise<{ success: boolean; result?: string; error?: string }>;
      llmGetModelPath: () => Promise<string>;
      llmSelectModel: () => Promise<{ success: boolean; path?: string }>;
      onLlmLoadProgress: (callback: (progress: number) => void) => void;
      onLlmToken: (callback: (token: string) => void) => void;
    };
  }
}

export default function App() {
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [filteredWorks, setFilteredWorks] = useState<WorkItem[]>([]);
  const [renderKey, setRenderKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('all');
  const [authorInput, setAuthorInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savePath, setSavePath] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [loadingCharCounts, setLoadingCharCounts] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'none' | 'charCount-asc' | 'charCount-desc'>('none');
  const [charCountFilter, setCharCountFilter] = useState<{ min: number; max: number }>({ min: 0, max: 1000000 });
  const [llmReady, setLlmReady] = useState(false);
  const [llmInitializing, setLlmInitializing] = useState(false);
  const [llmLoadProgress, setLlmLoadProgress] = useState(0);
  const [modelPath, setModelPath] = useState('');
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');

  useEffect(() => {
    loadWorks();
    window.electronAPI.onDownloadProgress((p) => setProgress(p));
    window.electronAPI.getSavePath().then(setSavePath);

    // LLM初期化状態とモデルパスを確認
    window.electronAPI.llmStatus().then(({ ready }) => setLlmReady(ready));
    window.electronAPI.llmGetModelPath().then(setModelPath);

    // モデルロード進捗
    window.electronAPI.onLlmLoadProgress((p) => setLlmLoadProgress(p));

    // ストリーミングトークン
    window.electronAPI.onLlmToken((token) => {
      setStreamingText((prev) => prev + token);
    });
  }, []);

  useEffect(() => {
    let filtered = works;

    // 作者フィルター
    if (selectedAuthor !== 'all') {
      filtered = filtered.filter(w => w.author === selectedAuthor);
    }

    // 検索フィルター
    if (searchTerm) {
      filtered = filtered.filter(w =>
        w.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 文字数フィルター
    filtered = filtered.filter(w => {
      if (!w.charCount) return true; // 文字数不明の作品は表示
      return w.charCount >= charCountFilter.min && w.charCount <= charCountFilter.max;
    });

    // ソート
    if (sortBy === 'charCount-asc') {
      filtered = [...filtered].sort((a, b) => {
        if (!a.charCount) return 1;
        if (!b.charCount) return -1;
        return a.charCount - b.charCount;
      });
    } else if (sortBy === 'charCount-desc') {
      filtered = [...filtered].sort((a, b) => {
        if (!a.charCount) return 1;
        if (!b.charCount) return -1;
        return b.charCount - a.charCount;
      });
    }

    setFilteredWorks(filtered);
    setRenderKey(prev => prev + 1);
  }, [searchTerm, selectedAuthor, works, sortBy, charCountFilter]);

  const loadWorks = async (all = false) => {
    setLoading(true);
    const response = await window.electronAPI.fetchWorks(all ? { all: true } : undefined);
    if (response.success && response.data) {
      setWorks(response.data);
    }
    setLoading(false);
  };

  const handleFetchAll = async () => {
    if (confirm('全作家（約1,300名）の作品を取得します。時間がかかりますがよろしいですか？')) {
      await window.electronAPI.clearCache();
      await loadWorks(true);
    }
  };

  const handleDownload = async (url: string, title: string) => {
    // 保存先チェック
    const isPathValid = await window.electronAPI.checkSavePath(savePath);
    if (!isPathValid) {
      setResult({
        type: 'error',
        message: '保存先が見つかりません。外部ストレージを接続するか、設定から保存先を変更してください。'
      });
      return;
    }

    setDownloading(true);
    setResult(null);
    setProgress(null);

    const response = await window.electronAPI.downloadNovel(url);

    setDownloading(false);

    if (response.success) {
      setResult({ type: 'success', message: `${title} - 保存完了: ${savePath}` });
    } else {
      setResult({ type: 'error', message: response.error || '不明なエラー' });
    }
  };

  const handleSelectSavePath = async () => {
    const response = await window.electronAPI.selectSavePath();
    if (response.success && response.path) {
      setSavePath(response.path);
      setResult({ type: 'success', message: `保存先を変更しました: ${response.path}` });
    }
  };

  const handleSelectModel = async () => {
    const response = await window.electronAPI.llmSelectModel();
    if (response.success && response.path) {
      setModelPath(response.path);
      setLlmReady(false);
    }
  };

  const authors = Array.from(new Set(works.map(w => w.author))).sort();

  // オートコンプリート用のフィルタリング
  const filteredAuthors = authorInput.trim()
    ? authors.filter(a => a.toLowerCase().includes(authorInput.toLowerCase())).slice(0, 50)
    : authors;

  // 作家選択のハンドラ
  const handleAuthorSelect = (author: string) => {
    setSelectedAuthor(author);
    setAuthorInput(author);
    setShowSuggestions(false);
  };

  // 作家検索のクリア
  const handleClearAuthor = () => {
    setAuthorInput('');
    setSelectedAuthor('all');
    setShowSuggestions(false);
  };

  // 文字数を遅延ロード（正確な文字数取得）
  const loadCharCount = async (work: WorkItem) => {
    if (work.charCount || loadingCharCounts.has(work.id)) return;

    setLoadingCharCounts(prev => new Set(prev).add(work.id));

    const response = await window.electronAPI.fetchAccurateCharCount(work.url);
    
    if (response.success && response.charCount) {
      // worksステートを更新
      setWorks(prevWorks => 
        prevWorks.map(w => 
          w.id === work.id ? { ...w, charCount: response.charCount } : w
        )
      );
    }

    setLoadingCharCounts(prev => {
      const next = new Set(prev);
      next.delete(work.id);
      return next;
    });
  };

  const handleSummarize = async (work: WorkItem) => {
    if (summarizingId) return;

    // モデル未初期化なら先にinit
    if (!llmReady) {
      setLlmInitializing(true);
      setLlmLoadProgress(0);
      const initRes = await window.electronAPI.llmInit();
      setLlmInitializing(false);
      if (!initRes.success) {
        setSummaries((prev) => ({
          ...prev,
          [work.id]: `エラー: ${initRes.error || 'モデルの読み込みに失敗しました。設定からGGUFファイルを選択してください。'}`
        }));
        return;
      }
      setLlmReady(true);
    }

    setSummarizingId(work.id);
    setStreamingText('');

    const res = await window.electronAPI.llmSummarizeWork(work.url);

    setSummaries((prev) => ({
      ...prev,
      [work.id]: res.success ? (res.result || '') : `エラー: ${res.error}`
    }));
    setSummarizingId(null);
    setStreamingText('');
  };

  // 表示される作品の文字数を取得
  useEffect(() => {
    filteredWorks.slice(0, 20).forEach(work => {
      if (!work.charCount) {
        loadCharCount(work);
      }
    });
  }, [filteredWorks]);

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <div style={{ padding: '20px', borderBottom: '1px solid #ddd', background: '#f5f5f5' }}>
        <h1 style={{ margin: 0, marginBottom: '15px' }}>📚 aozora</h1>
        
        {/* 検索・フィルターエリア */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="作品名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '10px',
              border: '2px solid #ccc',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          
          <div style={{ position: 'relative', flex: '0 0 250px' }}>
            <input
              type="text"
              placeholder="作家名で絞り込み..."
              value={authorInput}
              onChange={(e) => {
                setAuthorInput(e.target.value);
                setSelectedAuthor('all');
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              style={{
                width: '100%',
                padding: '10px 35px 10px 10px',
                border: '2px solid #ccc',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            {authorInput && (
              <button
                onClick={handleClearAuthor}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#999',
                  padding: '0 5px'
                }}
              >
                ×
              </button>
            )}
            {showSuggestions && filteredAuthors.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
                  zIndex: 1000
                }}
              >
                {filteredAuthors.map(author => (
                  <div
                    key={author}
                    onClick={() => handleAuthorSelect(author)}
                    style={{
                      padding: '10px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    📝 {author}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* フィルター・ソートエリア */}
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '6px 10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px',
              background: '#ffffff'
            }}
          >
            <option value="none">並び替えなし</option>
            <option value="charCount-asc">短い順</option>
            <option value="charCount-desc">長い順</option>
          </select>

          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', fontSize: '12px' }}>
            <span>文字数:</span>
            <input
              type="number"
              placeholder="最小"
              value={charCountFilter.min || ''}
              onChange={(e) => setCharCountFilter(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
              style={{
                width: '80px',
                padding: '4px 6px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            />
            <span>〜</span>
            <input
              type="number"
              placeholder="最大"
              value={charCountFilter.max === 1000000 ? '' : charCountFilter.max}
              onChange={(e) => setCharCountFilter(prev => ({ ...prev, max: parseInt(e.target.value) || 1000000 }))}
              style={{
                width: '80px',
                padding: '4px 6px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {loading ? '読み込み中...' : `${filteredWorks.length} / ${works.length} 作品`}
            {savePath && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#999' }}>
                💾 保存先: {savePath}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                padding: '6px 12px',
                background: '#757575',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ⚙️ 設定
            </button>
            <button
              onClick={handleFetchAll}
              disabled={loading}
              style={{
                padding: '6px 12px',
                background: loading ? '#ccc' : '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              全作家取得
            </button>
          </div>
        </div>

        {/* 設定パネル */}
        {showSettings && (
          <div style={{
            marginTop: '15px',
            padding: '15px',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>保存先設定</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{
                flex: 1,
                padding: '8px',
                background: '#f9f9f9',
                  border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '12px',
                wordBreak: 'break-all'
              }}>
                {savePath || 'デフォルト: Downloads/aozora'}
              </div>
              <button
                onClick={handleSelectSavePath}
                style={{
                  padding: '8px 16px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap'
                }}
              >
                📁 参照...
              </button>
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
              ※ ダウンロード時に保存先が存在しない場合はエラーになります
            </div>

            <h3 style={{ margin: '16px 0 10px 0', fontSize: '14px' }}>LLMモデル設定</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{
                flex: 1,
                padding: '8px',
                background: '#f9f9f9',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '11px',
                wordBreak: 'break-all',
                color: modelPath ? '#333' : '#999'
              }}>
                {modelPath || 'GGUFファイルが未設定'}
              </div>
              <button
                onClick={handleSelectModel}
                style={{
                  padding: '8px 16px',
                  background: '#7B1FA2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap'
                }}
              >
                📂 GGUFを選択
              </button>
            </div>
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#666' }}>
              ※ 状態: {llmReady ? '✅ 読み込み済み' : modelPath ? '⏸ 未読み込み（要約ボタン押下時に自動ロード）' : '❌ 未設定'}
            </div>
          </div>
        )}
      </div>

      {/* 作品リスト */}
      <div key={renderKey} style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {filteredWorks.map((work) => {
          const isSummarizing = summarizingId === work.id;
          const summary = summaries[work.id];
          const displayText = isSummarizing ? streamingText : summary;

          return (
            <div
              key={`${work.id}-${work.url}`}
              style={{
                padding: '15px',
                marginBottom: '10px',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #eee'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{work.title}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {work.author} · {work.textType}
                  </div>
                  {work.charCount ? (
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>
                      📊 約{work.charCount.toLocaleString()}字
                    </div>
                  ) : loadingCharCounts.has(work.id) ? (
                    <div style={{ fontSize: '12px', color: '#bbb', marginTop: '3px' }}>
                      ⏳ 文字数取得中...
                    </div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleSummarize(work)}
                    disabled={!!summarizingId || llmInitializing}
                    style={{
                      padding: '8px 14px',
                      background: isSummarizing ? '#FF9800' : summary ? '#9C27B0' : '#607D8B',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: (summarizingId || llmInitializing) ? 'not-allowed' : 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    {isSummarizing ? '⏳ 要約中...' : summary ? '🔄 再要約' : '📝 要約'}
                  </button>
                  <button
                    onClick={() => handleDownload(work.url, work.title)}
                    disabled={downloading}
                    style={{
                      padding: '8px 16px',
                      background: downloading ? '#ccc' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: downloading ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ダウンロード
                  </button>
                </div>
              </div>

              {/* 要約表示エリア */}
              {displayText && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: '#f8f4ff',
                  borderLeft: '3px solid #9C27B0',
                  borderRadius: '4px',
                  fontSize: '13px',
                  lineHeight: '1.7',
                  color: '#333',
                  whiteSpace: 'pre-wrap'
                }}>
                  {displayText}
                  {isSummarizing && <span style={{ opacity: 0.5 }}>▌</span>}
                </div>
              )}

              {/* モデルロード中プログレス */}
              {llmInitializing && !isSummarizing && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    モデル読み込み中... {llmLoadProgress}%
                  </div>
                  <div style={{ background: '#ddd', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${llmLoadProgress}%`,
                      height: '100%',
                      background: '#9C27B0',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 進捗・結果表示 */}
      {(progress || result) && (
        <div style={{ padding: '15px', borderTop: '1px solid #ddd', background: '#f5f5f5' }}>
          {progress && (
            <div>
              <div style={{ marginBottom: '8px', fontSize: '14px' }}>{progress.stage}</div>
              <div style={{ background: '#ddd', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progress.percent}%`,
                    height: '100%',
                    background: '#2196F3',
                    transition: 'width 0.3s'
                  }}
                />
              </div>
            </div>
          )}

          {result && (
            <div
              style={{
                padding: '10px',
                background: result.type === 'success' ? '#e8f5e9' : '#ffebee',
                color: result.type === 'success' ? '#2e7d32' : '#c62828',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              {result.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
