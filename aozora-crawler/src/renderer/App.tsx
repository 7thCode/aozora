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
      onDownloadProgress: (callback: (progress: { stage: string; percent: number }) => void) => void;
    };
  }
}

export default function App() {
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [filteredWorks, setFilteredWorks] = useState<WorkItem[]>([]);
  const [renderKey, setRenderKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('all');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadWorks();
    window.electronAPI.onDownloadProgress((p) => setProgress(p));
  }, []);

  useEffect(() => {
    console.log('🔍 Filter effect triggered:', { searchTerm, selectedAuthor, worksCount: works.length });
    
    let filtered = works;

    // 作者フィルター
    if (selectedAuthor !== 'all') {
      filtered = filtered.filter(w => w.author === selectedAuthor);
      console.log('📝 After author filter:', filtered.length);
    }

    // 検索フィルター
    if (searchTerm) {
      filtered = filtered.filter(w =>
        w.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
      console.log('🔎 After search filter:', filtered.length);
    }

    console.log('✅ Setting filteredWorks:', filtered.length);
    setFilteredWorks(filtered);
    setRenderKey(prev => prev + 1); // Force re-render with new key
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
    setDownloading(true);
    setResult(null);
    setProgress(null);

    const response = await window.electronAPI.downloadNovel(url);

    setDownloading(false);

    if (response.success) {
      setResult({ type: 'success', message: `${title} - 保存完了` });
    } else {
      setResult({ type: 'error', message: response.error || '不明なエラー' });
    }
  };

  const authors = Array.from(new Set(works.map(w => w.author))).sort();

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <div style={{ padding: '20px', borderBottom: '1px solid #ddd', background: 'white' }}>
        <h1 style={{ margin: 0, marginBottom: '15px' }}>📚 青空文庫クローラー</h1>
        
        {/* 検索・フィルターエリア */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="作品名または作者名で検索..."
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
          
          <select
            value={selectedAuthor}
            onChange={(e) => setSelectedAuthor(e.target.value)}
            style={{
              padding: '10px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              minWidth: '150px'
            }}
          >
            <option value="all">すべての作者</option>
            {authors.map(author => (
              <option key={author} value={author}>{author}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {loading ? '読み込み中...' : `${filteredWorks.length} / ${works.length} 作品`}
          </div>
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

      {/* 作品リスト */}
      <div key={renderKey} style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {console.log('📋 Rendering works list, count:', filteredWorks.length)}
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
                {work.charCount && ` · 約${work.charCount.toLocaleString()}字`}
              </div>
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
