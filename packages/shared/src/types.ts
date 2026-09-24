export type ProjectStatus = 'planning' | 'drafting' | 'revising' | 'completed' | 'published';
export type ChapterStatus = 'outline' | 'draft' | 'revised' | 'final';
export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor';
export type Genre = 'fantasy' | 'scifi' | 'romance' | 'mystery' | 'thriller' | 'horror' | 'literary' | 'historical' | 'young_adult' | 'adventure' | 'drama' | 'comedy' | 'blank';
export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama' | 'openrouter' | 'mistral';
export type ExportFormat = 'pdf' | 'docx' | 'epub' | 'md' | 'html' | 'txt' | 'json';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  aiProvider: AIProvider | null;
  aiModel: string | null;
  preferences: UserPreferences | null;
  createdAt: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'sepia';
  fontFamily: string;
  fontSize: number;
  editorWidth: 'narrow' | 'medium' | 'wide' | 'full';
  lineHeight: number;
  autoSaveInterval: number;
  typewriterMode: boolean;
  focusMode: boolean;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  genre: Genre | null;
  coverImageUrl: string | null;
  wordCountGoal: number | null;
  status: ProjectStatus;
  wordCount: number;
  chapterCount: number;
  settings: ProjectSettings | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSettings {
  font: string;
  theme: string;
  editorPrefs: Record<string, unknown>;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  content: string | null;
  contentFormat: 'markdown' | 'tiptap-json';
  summary: string | null;
  wordCount: number;
  orderIndex: number;
  status: ChapterStatus;
  parentId: string | null;
  notes: string | null;
  pov: string | null;
  location: string | null;
  charactersPresent: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  aliases: string[];
  role: CharacterRole | null;
  avatarUrl: string | null;
  age: string | null;
  gender: string | null;
  occupation: string | null;
  appearance: string | null;
  personality: string | null;
  background: string | null;
  motivation: string | null;
  characterArc: string | null;
  fears: string | null;
  desires: string | null;
  strengths: string | null;
  weaknesses: string | null;
  speechPattern: string | null;
  secrets: string | null;
  relationships: CharacterRelationship[];
  customFields: Record<string, string>;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CharacterRelationship {
  characterId: string;
  type: string;
  description: string;
}

export interface AIConversation {
  id: string;
  userId: string;
  projectId: string | null;
  title: string | null;
  provider: AIProvider;
  model: string;
  contextType: string | null;
  contextId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCount: number | null;
  createdAt: number;
}

export interface PromptTemplate {
  id: string;
  userId: string | null;
  name: string;
  category: string;
  template: string;
  variables: string[];
  description: string | null;
  isPublic: boolean;
  createdAt: number;
}

export interface WritingStats {
  totalWords: number;
  wordsToday: number;
  streak: number;
  avgWordsPerDay: number;
  totalProjects: number;
  totalChapters: number;
}
