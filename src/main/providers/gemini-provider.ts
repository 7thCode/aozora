import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LlmProvider } from '../llm-provider';

export class GeminiProvider implements LlmProvider {
  type = 'gemini';
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  isReady(): boolean {
    return true;
  }

  async summarize(text: string, onToken?: (t: string) => void, maxChars = 300): Promise<string> {
    const truncated = text.slice(0, 3000);
    const prompt = `あなたは日本語テキストの要約を行うアシスタントです。回答は必ずMarkdown形式で出力してください。\n\n次の文章を${maxChars}字以内でMarkdown形式で要約してください。見出し・箇条書き・強調などを適切に使ってください:\n\n${truncated}`;

    const model = this.genAI.getGenerativeModel({ model: this.model });
    const result = await model.generateContentStream(prompt);

    let full = '';
    for await (const chunk of result.stream) {
      const token = chunk.text();
      if (token) {
        full += token;
        onToken?.(token);
      }
    }
    return full;
  }

  async dispose(): Promise<void> {}
}
