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
      onDownloadProgress: (callback: (progress: { stage: string; percent: number }) => void) => void;
      getSavePath: () => Promise<string>;
      selectSavePath: () => Promise<{ success: boolean; path?: string }>;
      checkSavePath: (path: string) => Promise<boolean>;
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

  useEffect(() => {
    loadWorks();
    window.electronAPI.onDownloadProgress((p) => setProgress(p));
    window.electronAPI.getSavePath().then(setSavePath);
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

    setFilteredWorks(filtered);
    setRenderKey(prev => prev + 1);
  }, [searchTerm, selectedAuthor, works]);

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

  // 文字数を遅延ロード
  const loadCharCount = async (work: WorkItem) => {
    if (work.charCount || loadingCharCounts.has(work.id)) return;

    setLoadingCharCounts(prev => new Set(prev).add(work.id));

    const response = await window.electronAPI.fetchCharCount(work.url);
    
    if (response.success && response.charCount) {
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
      <div style={{ padding: '20px', borderBottom: '1px solid #ddd', background: 'white' }}>
        <h1 style={{ margin: 0, marginBottom: '15px' }}>📚 青空文庫クローラー</h1>
        
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
              border: '2px solid #ddd',
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
                border: '2px solid #ddd',
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
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
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
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    📝 {author}
                  </div>
                ))}
              </div>
            )}
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
            background: '#f5f5f5',
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>保存先設定</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{
                flex: 1,
                padding: '8px',
                background: 'white',
                border: '1px solid #ddd',
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
          </div>
        )}
      </div>

      {/* 作品リスト */}
      <div key={renderKey} style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {filteredWorks.map((work) => (
          <div
            key={`${work.id}-${work.url}`}
            style={{
              padding: '15px',
              marginBottom: '10px',
              background: 'white',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
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
        ))}
      </div>

      {/* 進捗・結果表示 */}
      {(progress || result) && (
        <div style={{ padding: '15px', borderTop: '1px solid #ddd', background: 'white' }}>
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
                color: result.type === 'success' ? '#388e3c' : '#c62828',
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
