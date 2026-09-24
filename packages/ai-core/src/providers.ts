// AI Provider Abstraction Layer
export type AIProviderName = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama' | 'openrouter' | 'mistral';

export interface AIMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  model: string;
  messages: AIMessageInput[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  apiKey: string;
  baseUrl?: string; // for Ollama / custom
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
}

export interface AIProvider {
  name: AIProviderName;
  chat(options: AICompletionOptions): Promise<string>;
  chatStream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk>;
}

// OpenAI Compatible Provider (OpenAI, Groq, OpenRouter, Mistral, Ollama)
export class OpenAICompatibleProvider implements AIProvider {
  name: AIProviderName;
  private defaultBaseUrl: string;

  constructor(name: AIProviderName, defaultBaseUrl: string) {
    this.name = name;
    this.defaultBaseUrl = defaultBaseUrl;
  }

  async chat(options: AICompletionOptions): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.chatStream(options)) {
      if (!chunk.done) chunks.push(chunk.content);
    }
    return chunks.join('');
  }

  async *chatStream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk> {
    const baseUrl = options.baseUrl || this.defaultBaseUrl;
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: true
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[${this.name}] API error ${res.status}: ${text}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No reader');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) yield { content, done: false };
        } catch {
          // ignore parse errors
        }
      }
    }
    yield { content: '', done: true };
  }
}

export class AnthropicProvider implements AIProvider {
  name: AIProviderName = 'anthropic';

  async chat(options: AICompletionOptions): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.chatStream(options)) {
      if (!chunk.done) chunks.push(chunk.content);
    }
    return chunks.join('');
  }

  async *chatStream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk> {
    const systemMessages = options.messages.filter(m => m.role === 'system');
    const userMessages = options.messages.filter(m => m.role !== 'system');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        system: systemMessages.map(m => m.content).join('\n\n'),
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
        stream: true
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[anthropic] API error ${res.status}: ${text}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No reader');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            if (json.type === 'content_block_delta' && json.delta?.text) {
              yield { content: json.delta.text, done: false };
            }
          } catch {}
        }
      }
    }
    yield { content: '', done: true };
  }
}

export class GeminiProvider implements AIProvider {
  name: AIProviderName = 'gemini';

  async chat(options: AICompletionOptions): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.chatStream(options)) {
      if (!chunk.done) chunks.push(chunk.content);
    }
    return chunks.join('');
  }

  async *chatStream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk> {
    const systemInstruction = options.messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    const contents = options.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:streamGenerateContent?key=${options.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 4096
        }
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[gemini] API error ${res.status}: ${text}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No reader');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Gemini returns JSON array chunks
      try {
        // Try parse as full JSON
        const cleaned = buffer.replace(/^\[|\]$/g, '').trim();
        if (!cleaned) continue;
        const parts = cleaned.split('},\n{').map((s, i, arr) => {
          if (arr.length > 1) {
            if (i === 0) return s + '}';
            if (i === arr.length - 1) return '{' + s;
            return '{' + s + '}';
          }
          return s;
        });
        for (const part of parts) {
          try {
            const json = JSON.parse(part);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield { content: text, done: false };
          } catch {}
        }
        buffer = '';
      } catch {
        // continue buffering
      }
    }
    yield { content: '', done: true };
  }
}

// Factory
export function createAIProvider(provider: AIProviderName): AIProvider {
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'openai':
      return new OpenAICompatibleProvider('openai', 'https://api.openai.com/v1');
    case 'groq':
      return new OpenAICompatibleProvider('groq', 'https://api.groq.com/openai/v1');
    case 'openrouter':
      return new OpenAICompatibleProvider('openrouter', 'https://openrouter.ai/api/v1');
    case 'mistral':
      return new OpenAICompatibleProvider('mistral', 'https://api.mistral.ai/v1');
    case 'ollama':
      return new OpenAICompatibleProvider('ollama', 'http://localhost:11434/v1');
    default:
      return new OpenAICompatibleProvider('openai', 'https://api.openai.com/v1');
  }
}
