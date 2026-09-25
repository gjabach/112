export const PROJECT_STATUSES = ['planning', 'drafting', 'revising', 'completed', 'published'] as const;
export const CHAPTER_STATUSES = ['outline', 'draft', 'revised', 'final'] as const;
export const CHARACTER_ROLES = ['protagonist', 'antagonist', 'supporting', 'minor'] as const;
export const GENRES = [
  'fantasy',
  'scifi',
  'romance',
  'mystery',
  'thriller',
  'horror',
  'literary',
  'historical',
  'young_adult',
  'adventure',
  'drama',
  'comedy',
  'blank'
] as const;

export const AI_PROVIDERS = ['openai', 'anthropic', 'gemini', 'groq', 'ollama', 'openrouter', 'mistral'] as const;

export const AI_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini', 'o1-preview'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  gemini: ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  mistral: ['mistral-large-latest', 'mistral-small-latest'],
  openrouter: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro'],
  ollama: ['llama3.2', 'mistral', 'gemma2', 'qwen2.5']
};

export const EXPORT_FORMATS = ['pdf', 'docx', 'epub', 'md', 'html', 'txt', 'json'] as const;

export const WORLD_ENTITY_TYPES = [
  'organization',
  'species',
  'item',
  'magic_system',
  'religion',
  'language',
  'event',
  'custom'
] as const;

export const OUTLINE_NODE_TYPES = ['act', 'chapter', 'scene', 'beat'] as const;
export const TIMELINE_IMPORTANCE = ['major', 'minor'] as const;
