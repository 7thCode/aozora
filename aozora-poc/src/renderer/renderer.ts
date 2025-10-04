// TypeScript型定義
declare global {
  interface Window {
    electronAPI: {
      downloadNovel: (url: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      onDownloadProgress: (callback: (data: any) => void) => void;
    };
  }
}

const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;
const urlInput = document.getElementById('novelUrl') as HTMLInputElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const statusText = document.getElementById('statusText') as HTMLSpanElement;

function showStatus(message: string, type: 'starting' | 'completed' | 'error') {
  statusDiv.className = `status show ${type}`;
  statusText.textContent = message;
}

// ダウンロードボタンクリック
downloadBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();

  if (!url) {
    showStatus('URLを入力してください', 'error');
    return;
  }

  downloadBtn.disabled = true;
  showStatus('ダウンロード準備中...', 'starting');

  try {
    const result = await window.electronAPI.downloadNovel(url);

    if (result.success) {
      showStatus(`✅ 完了: ${result.filePath}`, 'completed');
    } else {
      showStatus(`❌ エラー: ${result.error}`, 'error');
    }
  } catch (error) {
    showStatus(`❌ エラー: ${error}`, 'error');
  } finally {
    downloadBtn.disabled = false;
  }
});

// 進捗イベントリスナー
window.electronAPI.onDownloadProgress((data) => {
  console.log('📊 進捗:', data);

  if (data.status === 'starting') {
    showStatus(`📥 ダウンロード中: ${data.url}`, 'starting');
  } else if (data.status === 'completed') {
    showStatus(`✅ 完了: ${data.filePath}`, 'completed');
  } else if (data.status === 'error') {
    showStatus(`❌ エラー: ${data.error}`, 'error');
  }
});
