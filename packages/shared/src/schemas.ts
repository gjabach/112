import { z } from 'zod';
import { PROJECT_STATUSES, CHAPTER_STATUSES, CHARACTER_ROLES, GENRES, AI_PROVIDERS, EXPORT_FORMATS } from './constants';

export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  name: z.string().min(1, 'Tên không được để trống').max(100)
});

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu không được để trống')
});

export const createProjectSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được để trống').max(200),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  genre: z.enum(GENRES as unknown as [string, ...string[]]).optional(),
  wordCountGoal: z.number().int().min(0).max(10000000).optional(),
  status: z.enum(PROJECT_STATUSES as unknown as [string, ...string[]]).default('planning'),
  template: z.string().optional()
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  settings: z.record(z.unknown()).optional()
});

export const createChapterSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được để trống').max(200),
  content: z.string().optional(),
  contentFormat: z.enum(['markdown', 'tiptap-json']).default('tiptap-json'),
  summary: z.string().max(1000).optional(),
  orderIndex: z.number().int().min(0),
  status: z.enum(CHAPTER_STATUSES as unknown as [string, ...string[]]).default('outline'),
  parentId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  pov: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  charactersPresent: z.array(z.string()).default([])
});

export const updateChapterSchema = createChapterSchema.partial();

export const createCharacterSchema = z.object({
  name: z.string().min(1, 'Tên nhân vật không được để trống').max(100),
  aliases: z.array(z.string()).default([]),
  role: z.enum(CHARACTER_ROLES as unknown as [string, ...string[]]).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  age: z.string().max(50).optional(),
  gender: z.string().max(50).optional(),
  occupation: z.string().max(100).optional(),
  appearance: z.string().max(5000).optional(),
  personality: z.string().max(5000).optional(),
  background: z.string().max(5000).optional(),
  motivation: z.string().max(2000).optional(),
  characterArc: z.string().max(5000).optional(),
  fears: z.string().max(1000).optional(),
  desires: z.string().max(1000).optional(),
  strengths: z.string().max(1000).optional(),
  weaknesses: z.string().max(1000).optional(),
  speechPattern: z.string().max(1000).optional(),
  secrets: z.string().max(2000).optional(),
  relationships: z.array(z.object({
    characterId: z.string(),
    type: z.string(),
    description: z.string()
  })).default([]),
  customFields: z.record(z.string()).default({}),
  tags: z.array(z.string()).default([])
});

export const updateCharacterSchema = createCharacterSchema.partial();

export const aiSettingsSchema = z.object({
  aiProvider: z.enum(AI_PROVIDERS as unknown as [string, ...string[]]),
  aiApiKey: z.string().min(1, 'API Key không được để trống'),
  aiModel: z.string().min(1, 'Model không được để trống'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(100).max(128000).default(4096)
});

export const aiChatSchema = z.object({
  conversationId: z.string().optional(),
  projectId: z.string().optional(),
  contextType: z.string().optional(),
  contextId: z.string().optional(),
  message: z.string().min(1, 'Tin nhắn không được để trống'),
  provider: z.enum(AI_PROVIDERS as unknown as [string, ...string[]]).optional(),
  model: z.string().optional(),
  stream: z.boolean().default(true),
  contextLevel: z.enum(['current', 'last5', 'full']).default('current'),
  skill: z.string().optional()
});

export const createPromptTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  template: z.string().min(1, 'Template không được để trống'),
  variables: z.array(z.string()).default([]),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false)
});

export const exportSchema = z.object({
  format: z.enum(EXPORT_FORMATS as unknown as [string, ...string[]]),
  chapterIds: z.array(z.string()).optional(),
  includeFrontMatter: z.boolean().default(true),
  includeBackMatter: z.boolean().default(false),
  style: z.enum(['modern', 'classic', 'minimal']).default('modern')
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type AIChatInput = z.infer<typeof aiChatSchema>;
export type AISettingsInput = z.infer<typeof aiSettingsSchema>;
