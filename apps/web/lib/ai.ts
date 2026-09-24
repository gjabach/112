import { createAIProvider, type AIProviderName } from '@novelist/ai-core/src/providers';
import { getSkillById, type SkillContext } from '@novelist/ai-core/src/skills';

export interface AISettings {
  provider: AIProviderName;
  model: string;
  apiKey: string;
}

export function getAISettings(): AISettings {
  if (typeof window === 'undefined') {
    return { provider: 'gemini', model: 'gemini-1.5-flash', apiKey: '' };
  }
  const provider = (localStorage.getItem('ai_provider') as AIProviderName) || 'gemini';
  const apiKey = (localStorage.getItem('ai_api_key') || '').trim();
  let model = (localStorage.getItem('ai_model') || '').trim();

  if (!model) {
    if (provider === 'gemini') model = 'gemini-1.5-flash';
    else if (provider === 'groq') model = 'llama-3.3-70b-versatile';
    else if (provider === 'openai') model = 'gpt-4o-mini';
    else if (provider === 'anthropic') model = 'claude-3-5-sonnet-20241022';
    else model = 'gemini-1.5-flash';
  }

  return { provider, model, apiKey };
}

export function saveAISettings(settings: Partial<AISettings>): void {
  if (typeof window === 'undefined') return;
  if (settings.provider) localStorage.setItem('ai_provider', settings.provider);
  if (settings.model) localStorage.setItem('ai_model', settings.model);
  if (settings.apiKey !== undefined) {
    const cleanedKey = settings.apiKey.trim();
    localStorage.setItem('ai_api_key', cleanedKey);
  }

  // Sync to novelist_current_user
  try {
    const userStr = localStorage.getItem('novelist_current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      user.aiProvider = settings.provider || user.aiProvider || 'gemini';
      user.aiModel = settings.model || user.aiModel || 'gemini-1.5-flash';
      if (settings.apiKey !== undefined) {
        user.aiApiKey = settings.apiKey.trim();
      }
      localStorage.setItem('novelist_current_user', JSON.stringify(user));
    }
  } catch {}
}

export interface StreamChatParams {
  message: string;
  skill?: string | null;
  projectId?: string;
  contextType?: 'chapter' | 'project';
  contextId?: string;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
  overrideApiKey?: string;
  overrideProvider?: AIProviderName;
  overrideModel?: string;
}

function getLocalData(key: string, def: any = []) {
  if (typeof window === 'undefined') return def;
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : def;
  } catch {
    return def;
  }
}

export function buildProjectContext(projectId?: string, chapterId?: string): SkillContext {
  if (!projectId || typeof window === 'undefined') return {};

  const projects = getLocalData('novelist_projects', []);
  const project = projects.find((p: any) => p.id === projectId);
  const chapters = getLocalData('novelist_chapters', []).filter((c: any) => c.projectId === projectId);
  const characters = getLocalData('novelist_characters', []).filter((c: any) => c.projectId === projectId);

  const currentChapter = chapterId
    ? chapters.find((c: any) => c.id === chapterId)
    : chapters[chapters.length - 1];

  const previousSummary = chapters
    .filter((c: any) => c.id !== chapterId)
    .slice(-3)
    .map((c: any) => `- ${c.title}: ${(c.content || '').slice(0, 150)}...`)
    .join('\n');

  return {
    projectTitle: project?.title || '',
    projectDescription: project?.description || '',
    genre: project?.genre || '',
    currentChapterContent: (currentChapter?.content || '').slice(-2500),
    previousChaptersSummary: previousSummary,
    characters: characters.map((c: any) => ({
      name: c.name,
      description: c.personality || c.background || c.appearance || '',
      role: c.role
    })),
    language: 'Tiếng Việt'
  };
}

export async function executeAIChat(params: StreamChatParams): Promise<string> {
  const settings = getAISettings();
  const providerName = params.overrideProvider || settings.provider || 'gemini';
  const model = (params.overrideModel || settings.model || (providerName === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini')).trim();
  const apiKey = (params.overrideApiKey || settings.apiKey || '').trim();

  if (!apiKey && providerName !== 'ollama') {
    throw new Error(`Chưa có API key cho ${providerName.toUpperCase()}. Vui lòng vào Cài đặt (Settings) để thêm API key.`);
  }

  // Build context
  const ctx = buildProjectContext(params.projectId, params.contextId);
  ctx.userInstruction = params.message;

  let systemPrompt = 'Bạn là trợ lý AI chuyên nghiệp hỗ trợ nhà văn sáng tác tiểu thuyết. Hãy trả lời tự nhiên, giàu sức gợi và hỗ trợ đắc lực cho tác giả.';
  let promptContent = params.message;

  if (params.skill) {
    const skillObj = getSkillById(params.skill);
    if (skillObj) {
      systemPrompt = skillObj.systemPrompt;
      promptContent = skillObj.prompt(ctx);
    }
  }

  // 1. Try Next.js server route first (on Vercel or local Next dev)
  let serverRouteAttempted = false;
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: promptContent,
        systemPrompt,
        provider: providerName,
        model,
        apiKey,
        stream: params.stream !== false
      })
    });

    serverRouteAttempted = true;

    if (!res.ok) {
      let errorMsg = `Lỗi máy chủ AI (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson?.error) errorMsg = errJson.error;
      } catch {
        const t = await res.text();
        if (t) errorMsg = t;
      }
      throw new Error(errorMsg);
    }

    if (params.stream !== false && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.content) {
                full += data.content;
                params.onChunk?.(data.content);
              }
            } catch (err: any) {
              if (err.message && !err.message.includes('Unexpected end of JSON')) {
                throw err;
              }
            }
          }
        }
      }
      return full;
    } else {
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const result = data.content || '';
      params.onChunk?.(result);
      return result;
    }
  } catch (err: any) {
    // If the server route returned an explicit response (4xx, 5xx, or stream error),
    // throw it directly so the user gets the true error instead of a confusing "Failed to fetch"
    if (serverRouteAttempted) {
      throw err;
    }
    // If the endpoint is completely unreachable (e.g. offline static export), continue to fallback below
  }

  // 2. Direct client-side invocation fallback using @novelist/ai-core
  try {
    const provider = createAIProvider(providerName);
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptContent }
    ];

    if (params.stream !== false) {
      let full = '';
      for await (const chunk of provider.chatStream({ model, messages, apiKey, stream: true })) {
        if (chunk.content) {
          full += chunk.content;
          params.onChunk?.(chunk.content);
        }
      }
      return full;
    } else {
      const result = await provider.chat({ model, messages, apiKey });
      params.onChunk?.(result);
      return result;
    }
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message?.includes('fetch')) {
      throw new Error(`Không thể kết nối đến máy chủ AI (Failed to fetch). Nguyên nhân có thể do trình duyệt bật chặn quảng cáo/tracker (như Brave Shields, uBlock Origin) chặn tên miền AI, hoặc kết nối mạng bị gián đoạn.`);
    }
    throw err;
  }
}
