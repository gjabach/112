import { Hono } from 'hono';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp, decryptApiKey } from '../lib/auth';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';

type Variables = { db: any; user: AuthUser };
const outline = new Hono<{ Bindings: Env; Variables: Variables }>();

outline.use('*', authMiddleware);

// Outline templates
const OUTLINE_TEMPLATES = {
  'three-act': {
    name: '3-Act Structure',
    nameVi: 'Cấu trúc 3 Hồi',
    description: 'Cấu trúc kinh điển: Setup, Confrontation, Resolution',
    nodes: [
      { type: 'act', title: 'HỒI I: MỞ ĐẦU (Setup)', description: 'Giới thiệu thế giới, nhân vật chính, và inciting incident. 25% truyện.', color: '#3b82f6', children: [
        { type: 'chapter', title: 'Mở đầu - Thế giới thường nhật', description: 'Cuộc sống bình thường của nhân vật trước khi phiêu lưu bắt đầu' },
        { type: 'chapter', title: 'Lời kêu gọi phiêu lưu', description: 'Inciting incident - sự kiện phá vỡ thế giới thường nhật' },
        { type: 'chapter', title: 'Từ chối lời kêu gọi', description: 'Nhân vật do dự, sợ hãi, không muốn thay đổi' }
      ]},
      { type: 'act', title: 'HỒI II: ĐỐI ĐẦU (Confrontation)', description: 'Nhân vật đối mặt thử thách, học hỏi, thất bại. 50% truyện.', color: '#eab308', children: [
        { type: 'chapter', title: 'Vượt ngưỡng', description: 'Nhân vật quyết định dấn thân, bước vào thế giới mới' },
        { type: 'chapter', title: 'Thử thách, đồng minh, kẻ thù', description: 'Gặp mentor, bạn bè, kẻ thù. Học quy luật thế giới mới' },
        { type: 'chapter', title: 'Hang sâu nhất', description: 'Thử thách lớn nhất, đối mặt nỗi sợ lớn nhất, thất bại tạm thời' },
        { type: 'chapter', title: 'Phần thưởng', description: 'Chiến thắng nhỏ, có được thứ mình tìm kiếm nhưng chưa trọn vẹn' }
      ]},
      { type: 'act', title: 'HỒI III: KẾT THÚC (Resolution)', description: 'Trận chiến cuối cùng và trở về. 25% truyện.', color: '#22c55e', children: [
        { type: 'chapter', title: 'Đường trở về', description: 'Quyết định trở về, mang theo bài học' },
        { type: 'chapter', title: 'Phục sinh', description: 'Trận chiến cuối cùng, sử dụng tất cả những gì đã học' },
        { type: 'chapter', title: 'Trở về với Elixir', description: 'Kết thúc, nhân vật thay đổi, thế giới tốt đẹp hơn' }
      ]}
    ]
  },
  'hero-journey': {
    name: "Hero's Journey",
    nameVi: 'Hành Trình Người Hùng (12 bước)',
    description: 'Theo Joseph Campbell - 12 bước hành trình',
    nodes: [
      { type: 'act', title: 'HỒI I: RA ĐI', color: '#8b5cf6', children: [
        { type: 'beat', title: '1. Thế giới thường nhật', description: 'Cuộc sống bình thường' },
        { type: 'beat', title: '2. Lời kêu gọi phiêu lưu', description: 'Thử thách xuất hiện' },
        { type: 'beat', title: '3. Từ chối lời kêu gọi', description: 'Do dự, sợ hãi' },
        { type: 'beat', title: '4. Gặp gỡ người cố vấn', description: 'Mentor xuất hiện, cho lời khuyên/vũ khí' },
        { type: 'beat', title: '5. Vượt qua ngưỡng đầu tiên', description: 'Quyết định dấn thân' }
      ]},
      { type: 'act', title: 'HỒI II: KHAI SÁNG', color: '#f59e0b', children: [
        { type: 'beat', title: '6. Thử thách, đồng minh, kẻ thù', description: 'Học luật thế giới mới' },
        { type: 'beat', title: '7. Tiếp cận hang sâu nhất', description: 'Chuẩn bị cho thử thách lớn' },
        { type: 'beat', title: '8. Thử thách cam go', description: 'Đối mặt cái chết, thất bại' },
        { type: 'beat', title: '9. Phần thưởng', description: 'Chiến thắng tạm thời' }
      ]},
      { type: 'act', title: 'HỒI III: TRỞ VỀ', color: '#10b981', children: [
        { type: 'beat', title: '10. Đường trở về', description: 'Quyết định quay lại' },
        { type: 'beat', title: '11. Phục sinh', description: 'Thử thách cuối cùng, biến đổi' },
        { type: 'beat', title: '12. Trở về với Elixir', description: 'Mang phần thưởng về cho cộng đồng' }
      ]}
    ]
  },
  'save-the-cat': {
    name: 'Save the Cat (15 Beats)',
    nameVi: 'Save the Cat - 15 Nhịp',
    description: 'Blake Snyder - Cấu trúc cho phim và tiểu thuyết thương mại',
    nodes: [
      { type: 'beat', title: '1. Opening Image (1%)', description: 'Hình ảnh mở đầu, tone, thế giới' },
      { type: 'beat', title: '2. Theme Stated (5%)', description: 'Chủ đề được nói ra, nhân vật chưa hiểu' },
      { type: 'beat', title: '3. Set-Up (1-10%)', description: 'Giới thiệu nhân vật, thế giới, flaw' },
      { type: 'beat', title: '4. Catalyst (10%)', description: 'Inciting incident' },
      { type: 'beat', title: '5. Debate (10-25%)', description: 'Nhân vật do dự, có nên đi không?' },
      { type: 'beat', title: '6. Break into Two (25%)', description: 'Quyết định dấn thân vào Act 2' },
      { type: 'beat', title: '7. B Story (30%)', description: 'Câu chuyện tình cảm/phụ, mang theme' },
      { type: 'beat', title: '8. Fun and Games (30-50%)', description: 'Promise of premise - phần vui nhất' },
      { type: 'beat', title: '9. Midpoint (50%)', description: 'False victory hoặc false defeat' },
      { type: 'beat', title: '10. Bad Guys Close In (50-75%)', description: 'Khó khăn chồng chất, nội bộ lục đục' },
      { type: 'beat', title: '11. All Is Lost (75%)', description: 'Whiff of death - mất tất cả' },
      { type: 'beat', title: '12. Dark Night of the Soul (75-80%)', description: 'Tuyệt vọng, suy ngẫm' },
      { type: 'beat', title: '13. Finale (80-99%)', description: 'Áp dụng bài học, chiến đấu, chiến thắng' },
      { type: 'beat', title: '14. Final Image (99-100%)', description: 'Đối lập Opening Image, cho thấy thay đổi' }
    ]
  },
  'snowflake': {
    name: 'Snowflake Method',
    nameVi: 'Phương Pháp Bông Tuyết',
    description: 'Randy Ingermanson - Phát triển từ 1 câu lên tiểu thuyết',
    nodes: [
      { type: 'act', title: 'Bước 1-3: Nền tảng', color: '#06b6d4', children: [
        { type: 'beat', title: '1 câu tóm tắt', description: 'Viết 1 câu tóm tắt truyện (15 từ)' },
        { type: 'beat', title: '1 đoạn tóm tắt', description: 'Mở rộng thành 1 đoạn 5 câu: setup, disaster 1,2,3, ending' },
        { type: 'beat', title: 'Nhân vật chính', description: 'Tên, 1 câu story, motivation, goal, conflict, epiphany, 1 đoạn arc' }
      ]},
      { type: 'act', title: 'Bước 4-6: Mở rộng', color: '#8b5cf6', children: [
        { type: 'beat', title: 'Mở rộng tóm tắt', description: 'Mỗi câu trong đoạn tóm tắt thành 1 đoạn' },
        { type: 'beat', title: 'Nhân vật phụ', description: 'Viết character sheet cho các nhân vật chính' },
        { type: 'beat', title: 'Mở rộng lần 2', description: 'Mỗi đoạn trong tóm tắt 1 trang thành 1 trang đầy đủ' }
      ]},
      { type: 'act', title: 'Bước 7-10: Hoàn thiện', color: '#f59e0b', children: [
        { type: 'beat', title: 'Character bible', description: 'Chi tiết tất cả nhân vật, backstory' },
        { type: 'beat', title: 'List scenes', description: 'Liệt kê tất cả scenes từ tóm tắt 4 trang' },
        { type: 'beat', title: 'Narrative description', description: 'Viết mô tả chi tiết cho mỗi scene' },
        { type: 'beat', title: 'Viết bản thảo', description: 'Bắt đầu viết! Đã có outline chi tiết' }
      ]}
    ]
  }
};

// GET /api/projects/:projectId/outline
outline.get('/projects/:projectId/outline', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const nodes = await db.select().from(schema.outlineNodes).where(eq(schema.outlineNodes.projectId, projectId)).orderBy(asc(schema.outlineNodes.orderIndex));
  
  // Build tree structure
  const buildTree = (parentId: string | null): any[] => {
    return nodes
      .filter((n: any) => n.parentId === parentId)
      .map((n: any) => ({
        ...n,
        children: buildTree(n.id)
      }))
      .sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  };

  const tree = buildTree(null);
  const flat = nodes;

  // Calculate progress
  const total = nodes.length;
  const completed = nodes.filter((n: any) => n.status === 'written' || n.status === 'revised').length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return c.json({ 
    outline: tree,
    flat,
    progress,
    total,
    completed,
    templates: Object.keys(OUTLINE_TEMPLATES)
  });
});

// POST /api/projects/:projectId/outline - Create node
outline.post('/projects/:projectId/outline', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const body = await c.req.json();

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const id = generateId();
  const now = nowTimestamp();

  // Get max orderIndex for parent
  const siblings = await db.select().from(schema.outlineNodes).where(and(eq(schema.outlineNodes.projectId, projectId), body.parentId ? eq(schema.outlineNodes.parentId, body.parentId) : isNull(schema.outlineNodes.parentId)));
  
  await db.insert(schema.outlineNodes).values({
    id,
    projectId,
    parentId: body.parentId || null,
    type: body.type || 'scene',
    title: body.title,
    description: body.description || null,
    orderIndex: body.orderIndex ?? siblings.length,
    status: body.status || 'idea',
    linkedChapterId: body.linkedChapterId || null,
    color: body.color || null,
    createdAt: now,
    updatedAt: now
  });

  return c.json({ id }, 201);
});

// POST /api/projects/:projectId/outline/template - Apply template
outline.post('/projects/:projectId/outline/template', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const { templateId } = await c.req.json();

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const template = (OUTLINE_TEMPLATES as any)[templateId];
  if (!template) return c.json({ error: 'Template not found' }, 404);

  // Clear existing outline? Optional - we append
  const now = nowTimestamp();
  let orderIndex = 0;

  const createNodesRecursively = async (nodes: any[], parentId: string | null = null) => {
    for (const node of nodes) {
      const id = generateId();
      await db.insert(schema.outlineNodes).values({
        id,
        projectId,
        parentId,
        type: node.type,
        title: node.title,
        description: node.description || null,
        orderIndex: orderIndex++,
        status: 'idea',
        color: node.color || null,
        createdAt: now + orderIndex,
        updatedAt: now + orderIndex
      });

      if (node.children && node.children.length > 0) {
        await createNodesRecursively(node.children, id);
      }
    }
  };

  await createNodesRecursively(template.nodes);

  return c.json({ success: true, template: template.name });
});

// GET /api/outline/:id
const getOutlineNodeHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.outlineNodes).where(eq(schema.outlineNodes.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Node not found' }, 404);

  const node = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, node.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  return c.json({ node });
};
outline.get('/outline/:id', getOutlineNodeHandler);
outline.get('/:id', getOutlineNodeHandler);

// PATCH /api/outline/:id
const patchOutlineNodeHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await db.select().from(schema.outlineNodes).where(eq(schema.outlineNodes.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Node not found' }, 404);

  const node = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, node.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  const updates: any = { updatedAt: nowTimestamp() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.type !== undefined) updates.type = body.type;
  if (body.status !== undefined) updates.status = body.status;
  if (body.color !== undefined) updates.color = body.color;
  if (body.parentId !== undefined) updates.parentId = body.parentId;
  if (body.orderIndex !== undefined) updates.orderIndex = body.orderIndex;
  if (body.linkedChapterId !== undefined) updates.linkedChapterId = body.linkedChapterId;

  await db.update(schema.outlineNodes).set(updates).where(eq(schema.outlineNodes.id, id));
  return c.json({ success: true });
};
outline.patch('/outline/:id', patchOutlineNodeHandler);
outline.patch('/:id', patchOutlineNodeHandler);

// DELETE /api/outline/:id
const deleteOutlineNodeHandler = async (c: any) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = c.req.param('id');

  const existing = await db.select().from(schema.outlineNodes).where(eq(schema.outlineNodes.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: 'Node not found' }, 404);

  const node = existing[0];
  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, node.projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Forbidden' }, 403);

  // Delete recursively - find all children
  const allNodes = await db.select().from(schema.outlineNodes).where(eq(schema.outlineNodes.projectId, node.projectId));
  const toDelete = new Set<string>([id]);
  
  const findChildren = (parentId: string) => {
    for (const n of allNodes) {
      if (n.parentId === parentId && !toDelete.has(n.id)) {
        toDelete.add(n.id);
        findChildren(n.id);
      }
    }
  };
  findChildren(id);

  for (const deleteId of toDelete) {
    await db.delete(schema.outlineNodes).where(eq(schema.outlineNodes.id, deleteId));
  }

  return c.json({ success: true, deletedCount: toDelete.size });
};
outline.delete('/outline/:id', deleteOutlineNodeHandler);
outline.delete('/:id', deleteOutlineNodeHandler);

// POST /api/projects/:projectId/outline/reorder
outline.post('/projects/:projectId/outline/reorder', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const { orderedIds } = await c.req.json(); // array of {id, orderIndex, parentId}

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  for (const item of orderedIds) {
    await db.update(schema.outlineNodes).set({
      orderIndex: item.orderIndex,
      parentId: item.parentId || null,
      updatedAt: nowTimestamp()
    }).where(eq(schema.outlineNodes.id, item.id));
  }

  return c.json({ success: true });
});

// POST /api/projects/:projectId/outline/generate - AI generate outline
outline.post('/projects/:projectId/outline/generate', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const { premise, genre, templateId, numChapters } = await c.req.json();

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  // Get user AI settings
  const userRecord = await db.select().from(schema.users).where(eq(schema.users.id, user.userId)).limit(1);
  const u = userRecord[0];
  if (!u.aiApiKey) return c.json({ error: 'Chưa cấu hình AI API Key' }, 400);

  const apiKey = await decryptApiKey(u.aiApiKey, c.env.ENCRYPTION_KEY);
  const provider = u.aiProvider || 'openai';
  const model = u.aiModel || 'gpt-4o-mini';

  const { createAIProvider } = await import('@novelist/ai-core/src/providers');
  const aiProvider = createAIProvider(provider as any);

  const systemPrompt = `Bạn là chuyên gia về cấu trúc truyện, bậc thầy về Save the Cat, Hero's Journey, 3-Act Structure.
Nhiệm vụ: Từ premise, tạo outline chi tiết cho tiểu thuyết.

Yêu cầu:
- Trả về JSON hợp lệ, không markdown, không giải thích
- Format: {"acts": [{"title": "...", "description": "...", "color": "#hex", "chapters": [{"title": "...", "description": "...", "type": "chapter"}]}]}
- Mỗi act có 2-4 chapters
- Mỗi chapter có title hấp dẫn và description 1-2 câu về mục tiêu, xung đột, kết quả
- Phù hợp thể loại ${genre || project[0].genre || 'chung'}
- Tổng số chương: ${numChapters || 10}
- Ngôn ngữ: Tiếng Việt
- Template tham khảo: ${templateId || 'three-act'}`;

  const userPrompt = `Premise: ${premise || project[0].description || project[0].title}
Thể loại: ${genre || project[0].genre}
Số chương mong muốn: ${numChapters || 10}

Hãy tạo outline JSON chi tiết.`;

  try {
    const result = await aiProvider.chat({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      maxTokens: 4000,
      apiKey
    });

    // Try parse JSON
    let outlineData;
    try {
      // Clean markdown code block if present
      const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
      outlineData = JSON.parse(cleaned);
    } catch (e) {
      // Fallback: try extract JSON
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        outlineData = JSON.parse(match[0]);
      } else {
        throw new Error('AI không trả về JSON hợp lệ: ' + result.slice(0, 200));
      }
    }

    // Save to DB
    const now = nowTimestamp();
    let orderIndex = 0;
    
    for (const act of outlineData.acts || []) {
      const actId = generateId();
      await db.insert(schema.outlineNodes).values({
        id: actId,
        projectId,
        parentId: null,
        type: 'act',
        title: act.title,
        description: act.description || null,
        orderIndex: orderIndex++,
        status: 'idea',
        color: act.color || '#3b82f6',
        createdAt: now + orderIndex,
        updatedAt: now + orderIndex
      });

      for (const ch of act.chapters || []) {
        const chId = generateId();
        await db.insert(schema.outlineNodes).values({
          id: chId,
          projectId,
          parentId: actId,
          type: ch.type || 'chapter',
          title: ch.title,
          description: ch.description || null,
          orderIndex: orderIndex++,
          status: 'idea',
          createdAt: now + orderIndex,
          updatedAt: now + orderIndex
        });

        if (ch.scenes) {
          for (const scene of ch.scenes) {
            const sceneId = generateId();
            await db.insert(schema.outlineNodes).values({
              id: sceneId,
              projectId,
              parentId: chId,
              type: 'scene',
              title: scene.title,
              description: scene.description || null,
              orderIndex: orderIndex++,
              status: 'idea',
              createdAt: now + orderIndex,
              updatedAt: now + orderIndex
            });
          }
        }
      }
    }

    return c.json({ success: true, outline: outlineData, generatedCount: orderIndex });
  } catch (err: any) {
    return c.json({ error: 'AI generation failed: ' + err.message }, 500);
  }
});

// GET /api/projects/:projectId/outline/export
outline.get('/projects/:projectId/outline/export', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const format = c.req.query('format') || 'json';

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const nodes = await db.select().from(schema.outlineNodes).where(eq(schema.outlineNodes.projectId, projectId)).orderBy(asc(schema.outlineNodes.orderIndex));

  if (format === 'opml') {
    // OPML export
    let opml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n<head><title>${project[0].title} - Outline</title></head>\n<body>\n`;
    const buildOpml = (parentId: string | null, indent = 1) => {
      const children = nodes.filter((n: any) => n.parentId === parentId);
      let xml = '';
      for (const child of children) {
        const spaces = '  '.repeat(indent);
        xml += `${spaces}<outline text="${child.title.replace(/"/g, '&quot;')}" _note="${(child.description || '').replace(/"/g, '&quot;')}" />\n`;
        // Recursively add children inline? OPML nested
        const childNodes = nodes.filter((n: any) => n.parentId === child.id);
        if (childNodes.length > 0) {
          xml = xml.replace('/>\n', '>\n');
          xml += buildOpml(child.id, indent + 1);
          xml += `${spaces}</outline>\n`;
        }
      }
      return xml;
    };
    opml += buildOpml(null);
    opml += `</body>\n</opml>`;

    return new Response(opml, {
      headers: {
        'Content-Type': 'text/x-opml',
        'Content-Disposition': `attachment; filename="${project[0].title}-outline.opml"`
      }
    });
  }

  // JSON default
  return c.json({ project: project[0], outline: nodes });
});

export default outline;
export { OUTLINE_TEMPLATES };
