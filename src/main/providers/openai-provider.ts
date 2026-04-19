import OpenAI from 'openai';
import type { LlmProvider } from '../llm-provider';
import { getTemperature, getMaxTokens } from '../settings';

export class OpenAiProvider implements LlmProvider {
  type = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  isReady(): boolean {
    return true;
  }

  async summarize(text: string, onToken?: (t: string) => void, maxChars = 300): Promise<string> {
    const truncated = text.slice(0, 3000);
    const prompt = `次の文章を${maxChars}字以内でMarkdown形式で要約してください。見出し・箇条書き・強調などを適切に使ってください:\n\n${truncated}`;

    const stream = await this.client.chat.completions.create({
      model: this.model,
      temperature: getTemperature(),
      max_tokens: getMaxTokens(),
      messages: [
        { role: 'system', content: 'あなたは日本語テキストの要約を行うアシスタントです。回答は必ずMarkdown形式で出力してください。' },
        { role: 'user', content: prompt }
      ],
      stream: true,
    });

    let result = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) {
        result += token;
        onToken?.(token);
      }
    }
    return result;
  }

  async dispose(): Promise<void> {}
}
