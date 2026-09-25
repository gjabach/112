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

  private formatGeminiMessages(messages: AIMessageInput[]): {
    systemInstruction: string;
    contents: { role: string; parts: { text: string }[] }[];
  } {
    const systemInstruction = messages
      .filter(m => m.role === 'system')
      .map(m => m.content.trim())
      .filter(Boolean)
      .join('\n\n');

    const rawContents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: (m.content || '').trim() }]
      }))
      .filter(m => m.parts[0].text.length > 0);

    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const c of rawContents) {
      if (contents.length > 0 && contents[contents.length - 1].role === c.role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + c.parts[0].text;
      } else {
        contents.push({ role: c.role, parts: [{ text: c.parts[0].text }] });
      }
    }

    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({ role: 'user', parts: [{ text: 'Bắt đầu' }] });
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Xin chào' }] });
    }

    return { systemInstruction, contents };
  }

  private handleGeminiError(status: number, message: string): never {
    const cleanMsg = (message || '').trim();
    if (status === 400) {
      if (cleanMsg.includes('API_KEY_INVALID') || cleanMsg.includes('API key not valid')) {
        throw new Error('API Key Gemini không hợp lệ. Vui lòng kiểm tra lại key tại aistudio.google.com/app/apikey');
      }
      throw new Error(`[Gemini] Lỗi yêu cầu (400): ${cleanMsg}`);
    }
    if (status === 401) {
      if (cleanMsg.includes('API_KEY_SERVICE_BLOCKED') || cleanMsg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED')) {
        throw new Error('API Key này bị Google từ chối quyền truy cập (API_KEY_SERVICE_BLOCKED). Cách khắc phục: Vào aistudio.google.com/app/apikey -> bấm "Create API key" -> chọn "Create API key in new project" (Tạo trong dự án mới) để Google tự động kích hoạt API miễn phí.');
      }
      throw new Error(`[Gemini] Lỗi xác thực (401): ${cleanMsg}`);
    }
    if (status === 403) {
      throw new Error(`[Gemini] Quyền truy cập bị từ chối (403): ${cleanMsg}. Vui lòng kiểm tra tài khoản Google AI Studio.`);
    }
    if (status === 404) {
      throw new Error(`[Gemini] Không tìm thấy Model (404): ${cleanMsg}. Vui lòng chọn gemini-3.8-flash hoặc gemini-3.5-flash-lite trong Cài đặt.`);
    }
    if (status === 429) {
      throw new Error('Đã vượt quá hạn mức gọi Gemini (Rate limit / Quota exceeded 429). Thử lại sau ít phút.');
    }
    throw new Error(`[Gemini] Lỗi ${status}: ${cleanMsg}`);
  }

  async chat(options: AICompletionOptions): Promise<string> {
    const apiKey = (options.apiKey || '').trim();
    if (!apiKey) throw new Error('API Key Gemini không được để trống. Hãy nhập key trong Cài đặt.');
    const model = (options.model || 'gemini-3.8-flash').trim().replace(/^models\//, '');
    const { systemInstruction, contents } = this.formatGeminiMessages(options.messages);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const bodyPayload: any = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 4096
      }
    };
    if (systemInstruction) {
      bodyPayload.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok) {
      const text = await res.text();
      let errorMsg = text;
      try {
        const errJson = JSON.parse(text);
        errorMsg = errJson.error?.message || text;
      } catch {}

      // If requested model returned 404, automatically fallback to modern active models
      const geminiFallbacks = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
      const currentAttempt = (options as any)._fallbackAttempt || 0;
      const remainingFallbacks = geminiFallbacks.filter(m => m !== model);
      if (res.status === 404 && !(options as any)._disableFallback && currentAttempt < remainingFallbacks.length) {
        const nextModel = remainingFallbacks[currentAttempt];
        console.warn(`[Gemini] Model ${model} returned 404, auto-falling back to ${nextModel}`);
        return this.chat({ ...options, model: nextModel, _fallbackAttempt: currentAttempt + 1 } as any);
      }

      this.handleGeminiError(res.status, errorMsg);
    }

    const json = (await res.json()) as any;
    return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async *chatStream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk> {
    const apiKey = (options.apiKey || '').trim();
    if (!apiKey) throw new Error('API Key Gemini không được để trống. Hãy nhập key trong Cài đặt.');
    const model = (options.model || 'gemini-3.8-flash').trim().replace(/^models\//, '');
    const { systemInstruction, contents } = this.formatGeminiMessages(options.messages);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

    const bodyPayload: any = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 4096
      }
    };
    if (systemInstruction) {
      bodyPayload.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok) {
      const text = await res.text();
      let errorMsg = text;
      try {
        const errJson = JSON.parse(text);
        errorMsg = errJson.error?.message || text;
      } catch {}

      // If requested model returned 404, automatically fallback to modern active models
      const geminiFallbacks = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
      const currentAttempt = (options as any)._fallbackAttempt || 0;
      const remainingFallbacks = geminiFallbacks.filter(m => m !== model);
      if (res.status === 404 && !(options as any)._disableFallback && currentAttempt < remainingFallbacks.length) {
        const nextModel = remainingFallbacks[currentAttempt];
        console.warn(`[Gemini] Model ${model} returned 404 in stream, auto-falling back to ${nextModel}`);
        yield* this.chatStream({ ...options, model: nextModel, _fallbackAttempt: currentAttempt + 1 } as any);
        return;
      }

      this.handleGeminiError(res.status, errorMsg);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Không thể đọc dữ liệu phản hồi từ AI');
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.error?.message) {
            throw new Error(`[Gemini] ${parsed.error.message}`);
          }
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield { content: text, done: false };
        } catch (err: any) {
          if (err.message && err.message.startsWith('[Gemini]')) {
            throw err;
          }
        }
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      try {
        const parsed = JSON.parse(buffer.trim().slice(6).trim());
        if (parsed.error?.message) {
          throw new Error(`[Gemini] ${parsed.error.message}`);
        }
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield { content: text, done: false };
      } catch (err: any) {
        if (err.message && err.message.startsWith('[Gemini]')) {
          throw err;
        }
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
