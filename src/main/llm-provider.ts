export interface LlmProvider {
  type: string;
  isReady(): boolean;
  summarize(text: string, onToken?: (t: string) => void, maxChars?: number): Promise<string>;
  dispose(): Promise<void>;
}

let activeProvider: LlmProvider | null = null;

export function getActiveProvider(): LlmProvider | null {
  return activeProvider;
}

export function setActiveProvider(provider: LlmProvider | null): void {
  activeProvider = provider;
}
