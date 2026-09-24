export * from './providers';
export * from './skills';
export * from './context';

import { createAIProvider, type AIProviderName, type AIMessageInput, type AICompletionOptions } from './providers';
import { getSkillById, type SkillContext } from './skills';
import { buildContextPrompt, estimateTokens, truncateToTokenLimit, type ProjectContext } from './context';

export interface GenerateOptions {
  provider: AIProviderName;
  model: string;
  apiKey: string;
  baseUrl?: string;
  skillId?: string;
  skillContext?: SkillContext;
  projectContext?: ProjectContext;
  contextLevel?: 'current' | 'last5' | 'full';
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export async function generateAIResponse(options: GenerateOptions): Promise<string> {
  const provider = createAIProvider(options.provider);

  let systemPrompt = 'Bạn là trợ lý AI chuyên hỗ trợ nhà văn viết tiểu thuyết. Bạn am hiểu sâu sắc về nghệ thuật kể chuyện, xây dựng nhân vật, thế giới, và cấu trúc cốt truyện.';
  let userPrompt = options.userMessage;

  // Nếu có skill, dùng skill prompt
  if (options.skillId) {
    const skill = getSkillById(options.skillId);
    if (skill) {
      systemPrompt = skill.systemPrompt;
      if (options.skillContext) {
        userPrompt = skill.prompt(options.skillContext);
      }
    }
  }

  // Build context nếu có projectContext
  let contextText = '';
  if (options.projectContext) {
    contextText = buildContextPrompt(options.projectContext, options.contextLevel || 'current');
    contextText = truncateToTokenLimit(contextText, 6000); // giới hạn context
  }

  const messages: AIMessageInput[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (contextText) {
    messages.push({ role: 'system', content: `Ngữ cảnh dự án:\n${contextText}` });
  }

  messages.push({ role: 'user', content: userPrompt });

  const result = await provider.chat({
    model: options.model,
    messages,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 4096,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    stream: false
  });

  return result;
}

export async function* generateAIStream(options: GenerateOptions) {
  const provider = createAIProvider(options.provider);

  let systemPrompt = 'Bạn là trợ lý AI chuyên hỗ trợ nhà văn viết tiểu thuyết.';
  let userPrompt = options.userMessage;

  if (options.skillId) {
    const skill = getSkillById(options.skillId);
    if (skill) {
      systemPrompt = skill.systemPrompt;
      if (options.skillContext) {
        userPrompt = skill.prompt(options.skillContext);
      }
    }
  }

  let contextText = '';
  if (options.projectContext) {
    contextText = buildContextPrompt(options.projectContext, options.contextLevel || 'current');
    contextText = truncateToTokenLimit(contextText, 6000);
  }

  const messages: AIMessageInput[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (contextText) {
    messages.push({ role: 'system', content: `Ngữ cảnh dự án:\n${contextText}` });
  }

  messages.push({ role: 'user', content: userPrompt });

  yield* provider.chatStream({
    model: options.model,
    messages,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 4096,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    stream: true
  });
}
