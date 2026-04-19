import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider } from '../llm-provider';
import { getTemperature, getMaxTokens } from '../settings';

export class AnthropicProvider implements LlmProvider {
  type = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  isReady(): boolean {
    return true;
  }

  async summarize(text: string, onToken?: (t: string) => void, maxChars = 300): Promise<string> {
    const truncated = text.slice(0, 3000);
    const prompt = `次の文章を${maxChars}字以内でMarkdown形式で要約してください。見出し・箇条書き・強調などを適切に使ってください:\n\n${truncated}`;

    let result = '';
    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: getMaxTokens(),
      temperature: Math.min(getTemperature(), 1.0),
      system: 'あなたは日本語テキストの要約を行うアシスタントです。回答は必ずMarkdown形式で出力してください。',
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const token = event.delta.text;
        result += token;
        onToken?.(token);
      }
    }
    return result;
  }

  async dispose(): Promise<void> {}
}
