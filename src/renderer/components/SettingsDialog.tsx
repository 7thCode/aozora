import React, { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
  onProviderChanged: () => void;
}

type Tab = 'provider' | 'llm-params' | 'general';

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  border: 'none',
  borderBottom: active ? '2px solid #7B1FA2' : '2px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontWeight: active ? 'bold' : 'normal',
  color: active ? '#7B1FA2' : '#666',
  fontSize: '14px',
});

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '13px',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  background: '#fff',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#555',
  marginBottom: '4px',
  display: 'block',
};

const sectionStyle: React.CSSProperties = {
  background: '#f9f9f9',
  border: '1px solid #e0e0e0',
  borderRadius: '6px',
  padding: '14px',
  marginBottom: '12px',
};

const primaryBtn = (disabled = false): React.CSSProperties => ({
  padding: '6px 14px',
  background: disabled ? '#ccc' : '#7B1FA2',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: disabled ? 'default' : 'pointer',
  fontSize: '13px',
});

export const SettingsDialog: React.FC<Props> = ({ onClose, onProviderChanged }) => {
  const [tab, setTab] = useState<Tab>('provider');

  // プロバイダー設定
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [anthropicModel, setAnthropicModel] = useState('claude-haiku-4-5-20251001');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [hfToken, setHfToken] = useState('');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // LLMパラメータ
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(1024);

  // 一般設定
  const [savePath, setSavePath] = useState('');
  const [modelsDirectory, setModelsDirectory] = useState('');

  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.settingsGetAll().then((s) => {
      setOpenaiKey(s.openaiApiKey);
      setOpenaiModel(s.openaiModel);
      setAnthropicKey(s.anthropicApiKey);
      setAnthropicModel(s.anthropicModel);
      setGeminiKey(s.geminiApiKey);
      setGeminiModel(s.geminiModel);
      setHfToken(s.hfToken);
      setTemperature(s.temperature);
      setMaxTokens(s.maxTokens);
      setSavePath(s.savePath);
      setModelsDirectory(s.modelsDirectory);
    });
  }, []);

  const toggleKey = (id: string) =>
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));

  const flashSaved = (id: string) => {
    setSaved(id);
    setTimeout(() => setSaved(null), 1500);
  };

  const saveProvider = async (provider: string, apiKey: string, model: string) => {
    setSaving(provider);
    await window.electronAPI.llmProviderSet(provider, apiKey, model);
    setSaving(null);
    flashSaved(provider);
    onProviderChanged();
  };

  const saveHfToken = async () => {
    setSaving('hf');
    await window.electronAPI.settingsSetHfToken(hfToken);
    setSaving(null);
    flashSaved('hf');
  };

  const saveLlmParams = async () => {
    setSaving('llm');
    await Promise.all([
      window.electronAPI.settingsSetTemperature(temperature),
      window.electronAPI.settingsSetMaxTokens(maxTokens),
    ]);
    setSaving(null);
    flashSaved('llm');
  };

  const changeSavePath = async () => {
    const r = await window.electronAPI.selectSavePath();
    if (r.success && r.path) setSavePath(r.path);
  };

  const changeModelsDir = async () => {
    const r = await window.electronAPI.modelsDirSelect();
    if (r.success && r.path) {
      await window.electronAPI.modelsDirSet(r.path);
      setModelsDirectory(r.path);
    }
  };

  const savedBadge = (id: string) =>
    saved === id ? (
      <span style={{ color: '#4CAF50', fontSize: '12px', marginLeft: '8px' }}>✓ 保存しました</span>
    ) : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: '8px', width: '620px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        {/* ヘッダー */}
        <div style={{ background: '#7B1FA2', color: '#fff', padding: '16px 20px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>⚙️ 設定</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', padding: '0 16px' }}>
          <button style={tabBtn(tab === 'provider')} onClick={() => setTab('provider')}>プロバイダー</button>
          <button style={tabBtn(tab === 'llm-params')} onClick={() => setTab('llm-params')}>LLMパラメータ</button>
          <button style={tabBtn(tab === 'general')} onClick={() => setTab('general')}>一般</button>
        </div>

        {/* コンテンツ */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* ──── プロバイダータブ ──── */}
          {tab === 'provider' && (
            <div>
              {/* OpenAI */}
              <div style={sectionStyle}>
                <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>OpenAI</div>
                <label style={labelStyle}>APIキー</label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type={showKeys['openai'] ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => toggleKey('openai')} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                    {showKeys['openai'] ? '🙈' : '👁'}
                  </button>
                </div>
                <label style={labelStyle}>モデル</label>
                <select value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} style={{ ...selectStyle, marginBottom: '10px' }}>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                </select>
                <button
                  onClick={() => saveProvider('openai', openaiKey, openaiModel)}
                  disabled={saving === 'openai'}
                  style={primaryBtn(saving === 'openai')}
                >
                  {saving === 'openai' ? '保存中...' : '保存'}
                </button>
                {savedBadge('openai')}
              </div>

              {/* Anthropic */}
              <div style={sectionStyle}>
                <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>Anthropic (Claude)</div>
                <label style={labelStyle}>APIキー</label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type={showKeys['anthropic'] ? 'text' : 'password'}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => toggleKey('anthropic')} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                    {showKeys['anthropic'] ? '🙈' : '👁'}
                  </button>
                </div>
                <label style={labelStyle}>モデル</label>
                <select value={anthropicModel} onChange={(e) => setAnthropicModel(e.target.value)} style={{ ...selectStyle, marginBottom: '10px' }}>
                  <option value="claude-haiku-4-5-20251001">claude-haiku-4-5</option>
                  <option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
                  <option value="claude-opus-4-5">claude-opus-4-5</option>
                </select>
                <button
                  onClick={() => saveProvider('anthropic', anthropicKey, anthropicModel)}
                  disabled={saving === 'anthropic'}
                  style={primaryBtn(saving === 'anthropic')}
                >
                  {saving === 'anthropic' ? '保存中...' : '保存'}
                </button>
                {savedBadge('anthropic')}
              </div>

              {/* Gemini */}
              <div style={sectionStyle}>
                <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>Google Gemini</div>
                <label style={labelStyle}>APIキー</label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input
                    type={showKeys['gemini'] ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => toggleKey('gemini')} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                    {showKeys['gemini'] ? '🙈' : '👁'}
                  </button>
                </div>
                <label style={labelStyle}>モデル</label>
                <select value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} style={{ ...selectStyle, marginBottom: '10px' }}>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                </select>
                <button
                  onClick={() => saveProvider('gemini', geminiKey, geminiModel)}
                  disabled={saving === 'gemini'}
                  style={primaryBtn(saving === 'gemini')}
                >
                  {saving === 'gemini' ? '保存中...' : '保存'}
                </button>
                {savedBadge('gemini')}
              </div>

              {/* HF Token */}
              <div style={sectionStyle}>
                <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>Hugging Face トークン</div>
                <label style={labelStyle}>アクセストークン（モデルダウンロードに使用）</label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  <input
                    type={showKeys['hf'] ? 'text' : 'password'}
                    value={hfToken}
                    onChange={(e) => setHfToken(e.target.value)}
                    placeholder="hf_..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => toggleKey('hf')} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                    {showKeys['hf'] ? '🙈' : '👁'}
                  </button>
                </div>
                <button onClick={saveHfToken} disabled={saving === 'hf'} style={primaryBtn(saving === 'hf')}>
                  {saving === 'hf' ? '保存中...' : '保存'}
                </button>
                {savedBadge('hf')}
              </div>
            </div>
          )}

          {/* ──── LLMパラメータタブ ──── */}
          {tab === 'llm-params' && (
            <div>
              <div style={sectionStyle}>
                <div style={{ fontWeight: 'bold', marginBottom: '14px', color: '#333' }}>生成パラメータ</div>

                <label style={labelStyle}>Temperature（ランダム性）</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(2, parseFloat(e.target.value) || 0));
                      setTemperature(v);
                    }}
                    style={{ ...inputStyle, width: '70px', flex: 'none' }}
                  />
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '16px' }}>
                  低い値 → より確定的・一貫性重視　　高い値 → より創造的・多様性重視
                  <br />
                  ※ Anthropic (Claude) は最大 1.0 に自動制限されます
                </div>

                <label style={labelStyle}>Max Tokens（最大生成トークン数）</label>
                <input
                  type="number"
                  min={128}
                  max={8192}
                  step={128}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Math.max(128, Math.min(8192, parseInt(e.target.value) || 1024)))}
                  style={{ ...inputStyle, width: '120px', marginBottom: '16px' }}
                />

                <button onClick={saveLlmParams} disabled={saving === 'llm'} style={primaryBtn(saving === 'llm')}>
                  {saving === 'llm' ? '適用中...' : '適用'}
                </button>
                {savedBadge('llm')}
              </div>
            </div>
          )}

          {/* ──── 一般タブ ──── */}
          {tab === 'general' && (
            <div>
              <div style={sectionStyle}>
                <div style={{ fontWeight: 'bold', marginBottom: '14px', color: '#333' }}>ファイル保存先</div>
                <label style={labelStyle}>ダウンロード保存先</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                  <input type="text" readOnly value={savePath} style={{ ...inputStyle, flex: 1, background: '#f5f5f5', color: '#555' }} />
                  <button onClick={changeSavePath} style={primaryBtn()}>変更...</button>
                </div>
              </div>

              <div style={sectionStyle}>
                <div style={{ fontWeight: 'bold', marginBottom: '14px', color: '#333' }}>モデルディレクトリ</div>
                <label style={labelStyle}>ローカルモデルの保存先</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                  <input type="text" readOnly value={modelsDirectory} style={{ ...inputStyle, flex: 1, background: '#f5f5f5', color: '#555' }} />
                  <button onClick={changeModelsDir} style={primaryBtn()}>変更...</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
