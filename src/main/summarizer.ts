import { getTemperature, getMaxTokens } from './settings';

// node-llama-cpp はESMパッケージのため、new Function でTypeScriptのrequire変換を回避する
const esmImport = new Function('modulePath', 'return import(modulePath)') as
  (modulePath: string) => Promise<any>;

type LlamaChatSession = any;

let session: LlamaChatSession | null = null;
let loadedModelPath: string | null = null;

export async function initializeLlm(
  modelPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (session && loadedModelPath === modelPath) return;

  await disposeLlm();

  const { getLlama, LlamaChatSession } = await esmImport('node-llama-cpp');

  const llama = await getLlama();
  const model = await llama.loadModel({
    modelPath,
    onLoadProgress: (p: number) => onProgress?.(Math.round(p * 100))
  });

  const context = await model.createContext({ contextSize: 4096 });
  session = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt: 'あなたは日本語テキストの要約を行うアシスタントです。回答は必ずMarkdown形式で出力してください。'
  });

  loadedModelPath = modelPath;
}

export async function summarize(
  text: string,
  onToken?: (token: string) => void,
  maxChars = 300
): Promise<string> {
  if (!session) throw new Error('LLMが初期化されていません。先にモデルを読み込んでください。');

  const truncated = text.slice(0, 3000);
  const prompt = `次の文章を${maxChars}字以内でMarkdown形式で要約してください。見出し・箇条書き・強調などを適切に使ってください:\n\n${truncated}`;

  return await session.prompt(prompt, {
    temperature: getTemperature(),
    maxTokens: getMaxTokens(),
    onTextChunk: onToken
  });
}

export function isReady(): boolean {
  return session !== null;
}

export function getLoadedModelPath(): string | null {
  return loadedModelPath;
}

export async function disposeLlm(): Promise<void> {
  session = null;
  loadedModelPath = null;
}
