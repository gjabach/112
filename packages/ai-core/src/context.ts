// RAG & Context Builder cho AI
import type { SkillContext } from './skills';

export interface ProjectContext {
  project: {
    title: string;
    description?: string;
    genre?: string;
  };
  currentChapter?: {
    title: string;
    content: string;
    summary?: string;
  };
  previousChapters?: Array<{ title: string; summary: string; orderIndex: number }>;
  characters?: Array<{ name: string; description: string; role?: string }>;
  worldEntities?: Array<{ name: string; type: string; description: string }>;
}

export function buildContextPrompt(
  ctx: ProjectContext,
  level: 'current' | 'last5' | 'full' = 'current'
): string {
  const parts: string[] = [];

  parts.push(`# Dự án: ${ctx.project.title}`);
  if (ctx.project.genre) parts.push(`Thể loại: ${ctx.project.genre}`);
  if (ctx.project.description) parts.push(`Mô tả: ${ctx.project.description}`);

  if (ctx.characters && ctx.characters.length > 0) {
    const charList = ctx.characters.slice(0, level === 'current' ? 5 : 20)
      .map(c => `- ${c.name} (${c.role || 'không rõ vai trò'}): ${c.description.slice(0, 200)}`)
      .join('\n');
    parts.push(`\n## Nhân vật chính:\n${charList}`);
  }

  if (level !== 'current' && ctx.previousChapters && ctx.previousChapters.length > 0) {
    const count = level === 'last5' ? 5 : ctx.previousChapters.length;
    const prev = ctx.previousChapters
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .slice(-count)
      .map(ch => `- Chương ${ch.orderIndex}: ${ch.title} - ${ch.summary}`)
      .join('\n');
    parts.push(`\n## Tóm tắt các chương trước:\n${prev}`);
  }

  if (ctx.currentChapter) {
    const contentSlice = ctx.currentChapter.content.slice(0, level === 'full' ? 8000 : 3000);
    parts.push(`\n## Chương hiện tại: ${ctx.currentChapter.title}\n${contentSlice}`);
  }

  if (ctx.worldEntities && ctx.worldEntities.length > 0 && level === 'full') {
    const world = ctx.worldEntities.slice(0, 10)
      .map(e => `- ${e.name} (${e.type}): ${e.description.slice(0, 150)}`)
      .join('\n');
    parts.push(`\n## Thế giới:\n${world}`);
  }

  return parts.join('\n');
}

export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ~ 4 chars for Vietnamese/English mixed
  return Math.ceil(text.length / 4);
}

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) return text;
  const maxChars = maxTokens * 4;
  return text.slice(0, maxChars) + '\n...[truncated]';
}
