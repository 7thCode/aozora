import type { LlmProvider } from '../llm-provider';
import { initializeLlm, summarize, isReady, disposeLlm } from '../summarizer';

export class LocalProvider implements LlmProvider {
  type = 'local';

  isReady(): boolean {
    return isReady();
  }

  async summarize(text: string, onToken?: (t: string) => void, maxChars = 300): Promise<string> {
    return summarize(text, onToken, maxChars);
  }

  async dispose(): Promise<void> {
    await disposeLlm();
  }
}

export async function createLocalProvider(
  modelPath: string,
  onProgress?: (p: number) => void
): Promise<LocalProvider> {
  await initializeLlm(modelPath, onProgress);
  return new LocalProvider();
}
