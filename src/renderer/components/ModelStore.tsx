import { useState, useEffect, useCallback } from 'react';

type Tab = 'preset' | 'hf' | 'local';

interface ModelItem {
  id: string;
  name: string;
  author?: string;
  size?: number;
  memoryRequired?: number;
  quantization?: string;
  license?: string;
  commercial?: boolean;
  downloadUrl?: string;
  tags?: string[];
  description?: string;
  sizeFormatted?: string;
  path?: string;
  source?: string;
}

interface DownloadProgress {
  downloadId: string;
  modelId: string;
  percentage: number;
  speed: number;
  eta: number;
}

interface Props {
  onClose: () => void;
  onModelSelected?: (modelPath: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '?';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${Math.round(bps / 1024)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}分`;
  return `${(seconds / 3600).toFixed(1)}時間`;
}

export default function ModelStore({ onClose, onModelSelected }: Props) {
  const [tab, setTab] = useState<Tab>('preset');
  const [presetModels, setPresetModels] = useState<ModelItem[]>([]);
  const [localModels, setLocalModels] = useState<ModelItem[]>([]);
  const [hfModels, setHfModels] = useState<ModelItem[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [downloads, setDownloads] = useState<Record<string, DownloadProgress>>({});
  const [modelsDir, setModelsDir] = useState('');
  const [hfSearch, setHfSearch] = useState('');
  const [hfSort, setHfSort] = useState('downloads');
  const [hfCommercial, setHfCommercial] = useState(false);
  const [hfLoading, setHfLoading] = useState(false);
  const [hfError, setHfError] = useState('');
  const [filterLicense, setFilterLicense] = useState<'all' | 'commercial'>('all');

  const api = (window as any).electronAPI;

  const refreshLocalModels = useCallback(async () => {
    const res = await api.modelsList();
    setLocalModels(res.models || []);
    const ids = new Set<string>(
      (res.models || []).map((m: ModelItem) => m.id.replace('.gguf', ''))
    );
    setInstalledIds(ids);
  }, []);

  useEffect(() => {
    api.modelsGetPreset().then(setPresetModels);
    api.modelsDirGet().then((res: any) => setModelsDir(res.path || ''));
    refreshLocalModels();

    api.onModelsDownloadProgress((data: DownloadProgress) => {
      setDownloads((prev) => ({ ...prev, [data.modelId]: data }));
    });
    api.onModelsDownloadComplete((data: any) => {
      setDownloads((prev) => { const next = { ...prev }; delete next[data.modelId]; return next; });
      refreshLocalModels();
    });
    api.onModelsDownloadError((data: any) => {
      setDownloads((prev) => { const next = { ...prev }; delete next[data.modelId]; return next; });
      alert(`ダウンロードエラー: ${data.error}`);
    });
  }, []);

  const handleDownload = async (model: ModelItem) => {
    await api.modelsDownloadStart({ id: model.id, downloadUrl: model.downloadUrl, size: model.size });
  };

  const handleCancel = async (modelId: string) => {
    const prog = downloads[modelId];
    if (prog) await api.modelsDownloadCancel(prog.downloadId);
  };

  const handleDelete = async (model: ModelItem) => {
    if (!confirm(`「${model.name}」を削除しますか？`)) return;
    await api.modelsDelete(model.id);
    refreshLocalModels();
  };

  const handleSelectDir = async () => {
    const res = await api.modelsDirSelect();
    if (res.success && res.path) {
      await api.modelsDirSet(res.path);
      setModelsDir(res.path);
      refreshLocalModels();
    }
  };

  const handleHfSearch = async () => {
    setHfLoading(true);
    setHfError('');
    try {
      const res = await api.modelsHfSearch({
        search: hfSearch, sort: hfSort, commercialOnly: hfCommercial || null, limit: 20,
      });
      setHfModels(res.models || []);
    } catch (e: any) {
      setHfError(e.message || 'エラーが発生しました');
    }
    setHfLoading(false);
  };

  const handleUseModel = (model: ModelItem) => {
    if (model.path && onModelSelected) {
      onModelSelected(model.path);
      onClose();
    }
  };

  const filteredPresets = filterLicense === 'commercial'
    ? presetModels.filter((m) => m.commercial)
    : presetModels;

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', border: 'none', borderBottom: active ? '2px solid #7B1FA2' : '2px solid transparent',
    background: 'transparent', cursor: 'pointer', fontWeight: active ? 'bold' : 'normal',
    color: active ? '#7B1FA2' : '#666', fontSize: '14px',
  });

  const renderAction = (model: ModelItem) => {
    const prog = downloads[model.id];
    if (prog) {
      return (
        <div style={{ minWidth: 160 }}>
          <div style={{ fontSize: 11, marginBottom: 3 }}>
            {Math.round(prog.percentage)}% · {formatSpeed(prog.speed)} · 残{formatEta(prog.eta)}
          </div>
          <div style={{ background: '#ddd', borderRadius: 3, height: 6, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ width: `${prog.percentage}%`, height: '100%', background: '#7B1FA2', transition: 'width 0.5s' }} />
          </div>
          <button onClick={() => handleCancel(model.id)} style={{ fontSize: 11, padding: '2px 8px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
            キャンセル
          </button>
        </div>
      );
    }
    if (installedIds.has(model.id)) {
      return (
        <span style={{ fontSize: 12, color: '#4CAF50', padding: '4px 8px', border: '1px solid #4CAF50', borderRadius: 4 }}>
          ✅ インストール済み
        </span>
      );
    }
    return (
      <button onClick={() => handleDownload(model)} style={{ padding: '6px 14px', background: '#7B1FA2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
        ダウンロード
      </button>
    );
  };

  const renderCard = (model: ModelItem, showUseBtn = false) => (
    <div key={model.id} style={{ padding: 14, marginBottom: 10, background: '#fff', border: '1px solid #eee', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 3 }}>{model.name}</div>
          {model.author && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{model.author}</div>}
          {model.description && <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{model.description}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {model.quantization && <span style={{ fontSize: 11, padding: '1px 6px', background: '#e3f2fd', borderRadius: 3 }}>{model.quantization}</span>}
            {model.size ? <span style={{ fontSize: 11, padding: '1px 6px', background: '#f3e5f5', borderRadius: 3 }}>{formatBytes(model.size)}</span> : null}
            {model.sizeFormatted && <span style={{ fontSize: 11, padding: '1px 6px', background: '#f3e5f5', borderRadius: 3 }}>{model.sizeFormatted}</span>}
            {model.license && <span style={{ fontSize: 11, padding: '1px 6px', background: model.commercial ? '#e8f5e9' : '#fff8e1', borderRadius: 3 }}>{model.license}</span>}
            {(model.tags || []).map((t) => <span key={t} style={{ fontSize: 11, padding: '1px 6px', background: '#f5f5f5', borderRadius: 3 }}>#{t}</span>)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {showUseBtn && (
            <button onClick={() => handleUseModel(model)} style={{ padding: '6px 14px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
              このモデルを使用
            </button>
          )}
          {!showUseBtn && renderAction(model)}
          {showUseBtn && (
            <button onClick={() => handleDelete(model)} style={{ padding: '4px 10px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
              削除
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#f5f5f5', borderRadius: 12, width: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        {/* ヘッダー */}
        <div style={{ padding: '16px 20px', background: '#7B1FA2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>🤖 モデルストア</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #ddd', padding: '0 20px' }}>
          <button style={btnStyle(tab === 'preset')} onClick={() => setTab('preset')}>📦 プリセット</button>
          <button style={btnStyle(tab === 'hf')} onClick={() => setTab('hf')}>🤗 HuggingFace</button>
          <button style={btnStyle(tab === 'local')} onClick={() => setTab('local')}>💾 ダウンロード済み ({localModels.length})</button>
        </div>

        {/* コンテンツ */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>

          {/* プリセット タブ */}
          {tab === 'preset' && (
            <>
              <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={filterLicense} onChange={(e) => setFilterLicense(e.target.value as any)} style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}>
                  <option value="all">すべてのライセンス</option>
                  <option value="commercial">商用利用可のみ</option>
                </select>
                <span style={{ fontSize: 12, color: '#666' }}>{filteredPresets.length} モデル</span>
              </div>
              {filteredPresets.map((m) => renderCard(m))}
            </>
          )}

          {/* HuggingFace タブ */}
          {tab === 'hf' && (
            <>
              <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={hfSearch} onChange={(e) => setHfSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleHfSearch()} placeholder="キーワード (例: japanese, qwen)..." style={{ flex: 1, minWidth: 200, padding: '8px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }} />
                <select value={hfSort} onChange={(e) => setHfSort(e.target.value)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}>
                  <option value="downloads">ダウンロード数</option>
                  <option value="likes">Likes</option>
                  <option value="trending">トレンド</option>
                  <option value="lastModified">更新日</option>
                </select>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={hfCommercial} onChange={(e) => setHfCommercial(e.target.checked)} />
                  商用のみ
                </label>
                <button onClick={handleHfSearch} disabled={hfLoading} style={{ padding: '8px 16px', background: hfLoading ? '#ccc' : '#7B1FA2', color: '#fff', border: 'none', borderRadius: 4, cursor: hfLoading ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                  {hfLoading ? '検索中...' : '検索'}
                </button>
              </div>
              <div style={{ marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['日本語', 'qwen', 'llama', 'mistral', 'gemma'].map((hint) => (
                  <button key={hint} onClick={() => { setHfSearch(hint); }} style={{ fontSize: 11, padding: '3px 8px', background: '#e3f2fd', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
                    {hint}
                  </button>
                ))}
              </div>
              {hfError && <div style={{ color: '#c62828', marginBottom: 10, fontSize: 13 }}>{hfError}</div>}
              {!hfLoading && hfModels.length === 0 && <div style={{ color: '#999', fontSize: 13 }}>キーワードを入力して検索してください</div>}
              {hfModels.map((m) => renderCard(m))}
            </>
          )}

          {/* ダウンロード済み タブ */}
          {tab === 'local' && (
            <>
              {localModels.length === 0 && <div style={{ color: '#999', fontSize: 13 }}>ダウンロード済みモデルがありません</div>}
              {localModels.map((m) => renderCard(m, true))}
            </>
          )}
        </div>

        {/* フッター */}
        <div style={{ padding: '10px 20px', background: '#fff', borderTop: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ color: '#666' }}>保存先:</span>
          <span style={{ flex: 1, fontSize: 11, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modelsDir}</span>
          <button onClick={handleSelectDir} style={{ padding: '4px 10px', background: '#757575', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
            📁 変更
          </button>
        </div>
      </div>
    </div>
  );
}
