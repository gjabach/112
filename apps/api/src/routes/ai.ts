import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp, decryptApiKey } from '../lib/auth';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';
import { aiChatSchema } from '@novelist/shared';
import { createAIProvider } from '@novelist/ai-core/src/providers';
import { getSkillById } from '@novelist/ai-core/src/skills';

type Variables = { db: any; user: AuthUser };
const ai = new Hono<{ Bindings: Env; Variables: Variables }>();

ai.use('*', authMiddleware);

// POST /api/ai/chat - streaming chat
ai.post('/chat', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const body = await c.req.json();

  const parsed = aiChatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { conversationId, projectId, contextType, contextId, message, provider: reqProvider, model: reqModel, stream, contextLevel, skill } = parsed.data;

  // Get user AI settings
  const userRecord = await db.select().from(schema.users).where(eq(schema.users.id, user.userId)).limit(1);
  if (userRecord.length === 0) return c.json({ error: 'User not found' }, 404);

  const u = userRecord[0];
  const providerName = reqProvider || u.aiProvider || 'openai';
  const modelName = reqModel || u.aiModel || 'gpt-4o-mini';
  const encryptedKey = u.aiApiKey;

  if (!encryptedKey) {
    return c.json({ error: 'Chưa cấu hình AI API Key. Vui lòng vào Settings để thêm API key.' }, 400);
  }

  const apiKey = await decryptApiKey(encryptedKey, c.env.ENCRYPTION_KEY);
  if (!apiKey) {
    return c.json({ error: 'Không thể giải mã API key' }, 500);
  }

  // Build context if projectId provided
  let projectContext: any = null;
  if (projectId) {
    const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
    if (project.length > 0) {
      const p = project[0];
      const chapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, projectId));
      const characters = await db.select().from(schema.characters).where(eq(schema.characters.projectId, projectId));

      // Get current chapter if contextId is chapter
      let currentChapter: any = null;
      if (contextType === 'chapter' && contextId) {
        const ch = chapters.find((ch: any) => ch.id === contextId);
        if (ch) currentChapter = { title: ch.title, content: ch.content || '', summary: ch.summary || '' };
      } else if (chapters.length > 0) {
        // Use latest chapter
        const sorted = [...chapters].sort((a: any, b: any) => b.updatedAt - a.updatedAt);
        currentChapter = { title: sorted[0].title, content: (sorted[0].content || '').slice(0, 5000), summary: sorted[0].summary || '' };
      }

      const previousChapters = chapters.map((ch: any) => ({
        title: ch.title,
        summary: ch.summary || (ch.content ? ch.content.slice(0, 200) + '...' : ''),
        orderIndex: ch.orderIndex
      }));

      projectContext = {
        project: { title: p.title, description: p.description || '', genre: p.genre || '' },
        currentChapter,
        previousChapters,
        characters: characters.map((ch: any) => ({ name: ch.name, description: ch.personality || ch.background || '', role: ch.role })),
        worldEntities: []
      };
    }
  }

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    convId = generateId();
    const now = nowTimestamp();
    await db.insert(schema.aiConversations).values({
      id: convId,
      userId: user.userId,
      projectId: projectId || null,
      title: message.slice(0, 50),
      provider: providerName,
      model: modelName,
      contextType: contextType || null,
      contextId: contextId || null,
      createdAt: now,
      updatedAt: now
    });
  } else {
    // Verify ownership
    const conv = await db.select().from(schema.aiConversations).where(and(eq(schema.aiConversations.id, convId), eq(schema.aiConversations.userId, user.userId))).limit(1);
    if (conv.length === 0) return c.json({ error: 'Conversation not found' }, 404);
  }

  // Save user message
  const userMsgId = generateId();
  await db.insert(schema.aiMessages).values({
    id: userMsgId,
    conversationId: convId,
    role: 'user',
    content: message,
    tokenCount: Math.ceil(message.length / 4),
    createdAt: nowTimestamp()
  });

  // Build system prompt based on skill
  let systemPrompt = 'Bạn là trợ lý AI chuyên hỗ trợ nhà văn viết tiểu thuyết. Bạn am hiểu sâu sắc về nghệ thuật kể chuyện, xây dựng nhân vật, thế giới, và cấu trúc cốt truyện.';
  let finalUserMessage = message;

  if (skill) {
    const skillDef = getSkillById(skill);
    if (skillDef) {
      systemPrompt = skillDef.systemPrompt;
      // If skill expects context, build it
      if (projectContext) {
        const skillCtx = {
          projectTitle: projectContext.project.title,
          projectDescription: projectContext.project.description,
          genre: projectContext.project.genre,
          currentChapterContent: projectContext.currentChapter?.content,
          previousChaptersSummary: projectContext.previousChapters.map((ch: any) => `${ch.title}: ${ch.summary}`).join('\n'),
          characters: projectContext.characters,
          selectedText: message,
          userInstruction: '',
          language: 'Tiếng Việt'
        };
        finalUserMessage = skillDef.prompt(skillCtx);
      }
    }
  }

  // Prepare messages for provider
  const previousMessages = await db.select().from(schema.aiMessages).where(eq(schema.aiMessages.conversationId, convId)).orderBy(desc(schema.aiMessages.createdAt)).limit(10);
  const history = previousMessages.reverse().slice(0, -1).map((m: any) => ({ role: m.role as any, content: m.content }));

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (projectContext && !skill) {
    const ctxText = `Dự án: ${projectContext.project.title}\nThể loại: ${projectContext.project.genre}\nMô tả: ${projectContext.project.description}\n\nNhân vật: ${projectContext.characters.map((c: any) => `${c.name} (${c.role})`).join(', ')}\n\nChương hiện tại: ${projectContext.currentChapter?.title}\n${projectContext.currentChapter?.content?.slice(0, 3000) || ''}`;
    messages.push({ role: 'system' as const, content: `Ngữ cảnh:\n${ctxText}` });
  }

  for (const h of history) {
    if (h.role === 'user' || h.role === 'assistant') {
      messages.push(h);
    }
  }

  messages.push({ role: 'user' as const, content: finalUserMessage });

  if (stream) {
    // Streaming response
    const provider = createAIProvider(providerName as any);

    const streamResponse = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullContent = '';

        try {
          for await (const chunk of provider.chatStream({
            model: modelName,
            messages,
            temperature: 0.7,
            maxTokens: 4096,
            apiKey,
            stream: true
          })) {
            if (chunk.done) break;
            fullContent += chunk.content;
            const data = `data: ${JSON.stringify({ content: chunk.content, done: false, conversationId: convId })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          // Save assistant message
          const assistantMsgId = generateId();
          await db.insert(schema.aiMessages).values({
            id: assistantMsgId,
            conversationId: convId,
            role: 'assistant',
            content: fullContent,
            tokenCount: Math.ceil(fullContent.length / 4),
            createdAt: nowTimestamp()
          });

          // Update conversation
          await db.update(schema.aiConversations).set({ updatedAt: nowTimestamp() }).where(eq(schema.aiConversations.id, convId));

          const doneData = `data: ${JSON.stringify({ content: '', done: true, conversationId: convId })}\n\n`;
          controller.enqueue(encoder.encode(doneData));
          controller.close();
        } catch (err: any) {
          const errorData = `data: ${JSON.stringify({ error: err.message, done: true })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      }
    });

    return new Response(streamResponse, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } else {
    // Non-streaming
    const provider = createAIProvider(providerName as any);
    try {
      const result = await provider.chat({
        model: modelName,
        messages,
        temperature: 0.7,
        maxTokens: 4096,
        apiKey,
        stream: false
      });

      const assistantMsgId = generateId();
      await db.insert(schema.aiMessages).values({
        id: assistantMsgId,
        conversationId: convId,
        role: 'assistant',
        content: result,
        tokenCount: Math.ceil(result.length / 4),
        createdAt: nowTimestamp()
      });

      await db.update(schema.aiConversations).set({ updatedAt: nowTimestamp() }).where(eq(schema.aiConversations.id, convId));

      return c.json({ content: result, conversationId: convId });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
});

// GET /api/ai/conversations
ai.get('/conversations', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  const convs = await db.select().from(schema.aiConversations).where(eq(schema.aiConversations.userId, user.userId)).orderBy(desc(schema.aiConversations.updatedAt)).limit(50);
  return c.json({ conversations: convs });
});

// GET /api/ai/conversations/:id
ai.get('/conversations/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const conv = await db.select().from(schema.aiConversations).where(and(eq(schema.aiConversations.id, id), eq(schema.aiConversations.userId, user.userId))).limit(1);
  if (conv.length === 0) return c.json({ error: 'Conversation not found' }, 404);

  const messages = await db.select().from(schema.aiMessages).where(eq(schema.aiMessages.conversationId, id)).orderBy(desc(schema.aiMessages.createdAt));

  return c.json({ conversation: conv[0], messages: messages.reverse() });
});

// DELETE /api/ai/conversations/:id
ai.delete('/conversations/:id', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const conv = await db.select().from(schema.aiConversations).where(and(eq(schema.aiConversations.id, id), eq(schema.aiConversations.userId, user.userId))).limit(1);
  if (conv.length === 0) return c.json({ error: 'Conversation not found' }, 404);

  await db.delete(schema.aiConversations).where(eq(schema.aiConversations.id, id));
  return c.json({ success: true });
});

// GET /api/ai/prompts
ai.get('/prompts', async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  const prompts = await db.select().from(schema.promptTemplates).where(eq(schema.promptTemplates.isPublic, true));
  const userPrompts = await db.select().from(schema.promptTemplates).where(eq(schema.promptTemplates.userId, user.userId));

  const all = [...prompts, ...userPrompts].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

  // Also return built-in skills
  const { AI_SKILLS } = await import('@novelist/ai-core/src/skills');

  return c.json({ prompts: all, skills: AI_SKILLS });
});

export default ai;
