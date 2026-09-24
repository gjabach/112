import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { schema } from '../lib/db';
import { generateId, nowTimestamp } from '../lib/auth';
import type { Env } from '../index';
import { authMiddleware, type AuthUser } from '../middleware/auth';
import { generateExport, type ExportOptions, type ExportFormat } from '../lib/export';

type Variables = { db: any; user: AuthUser };
const exportRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

exportRoutes.use('*', authMiddleware);

// POST /api/export/:projectId - Generate export file thực tế
exportRoutes.post('/:projectId', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');
  const body = await c.req.json();

  const format = (body.format || 'pdf') as ExportFormat;
  const allowedFormats: ExportFormat[] = ['pdf', 'docx', 'epub', 'md', 'html', 'txt', 'json'];
  if (!allowedFormats.includes(format)) {
    return c.json({ error: `Format không hỗ trợ. Cho phép: ${allowedFormats.join(', ')}` }, 400);
  }

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const userRecord = await db.select().from(schema.users).where(eq(schema.users.id, user.userId)).limit(1);
  const authorName = userRecord[0]?.name || userRecord[0]?.email || 'Tác giả';

  const jobId = generateId();
  const now = nowTimestamp();

  await db.insert(schema.exportJobs).values({
    id: jobId,
    userId: user.userId,
    projectId,
    format,
    status: 'processing',
    options: JSON.stringify(body),
    createdAt: now
  });

  try {
    // Get chapters
    const chapters = await db.select().from(schema.chapters).where(eq(schema.chapters.projectId, projectId));

    // Build export options
    const exportOptions: ExportOptions = {
      format,
      includeFrontMatter: body.includeFrontMatter ?? true,
      includeToc: body.includeToc ?? true,
      style: body.style || 'modern',
      authorName: body.authorName || authorName,
      fontSize: body.fontSize || 12,
      lineSpacing: body.lineSpacing || 1.5,
      language: body.language || 'vi',
      chapterIds: body.chapterIds || undefined
    };

    // Generate file
    const projectData = {
      id: project[0].id,
      title: project[0].title,
      subtitle: project[0].subtitle,
      description: project[0].description,
      genre: project[0].genre,
      authorName: exportOptions.authorName
    };

    const result = await generateExport(projectData, chapters as any, exportOptions);

    // Store in R2
    let fileUrl: string | null = null;
    let fileKey: string | null = null;
    
    try {
      if (c.env.R2) {
        fileKey = `exports/${user.userId}/${projectId}/${jobId}.${result.extension}`;
        const dataToStore = typeof result.data === 'string' 
          ? new TextEncoder().encode(result.data)
          : result.data;

        await c.env.R2.put(fileKey, dataToStore as any, {
          httpMetadata: { 
            contentType: result.mimeType,
            contentDisposition: `attachment; filename="${project[0].title}.${result.extension}"`
          },
          customMetadata: {
            projectId,
            format,
            author: authorName,
            generatedAt: new Date().toISOString()
          }
        });
        fileUrl = fileKey;
      }
    } catch (e) {
      console.error('R2 error', e);
      // Continue even if R2 fails - we can still return data directly for small files
    }

    // Update job as done
    await db.update(schema.exportJobs).set({
      status: 'done',
      fileUrl,
      completedAt: nowTimestamp()
    }).where(eq(schema.exportJobs.id, jobId));

    // For direct download (if R2 not available or for preview), return data as base64 for binary formats
    let previewData: string | undefined;
    if (typeof result.data === 'string') {
      previewData = result.data.slice(0, 10000); // First 10k chars preview
    }

    // If file is small and R2 failed, we can return base64
    let downloadData: string | undefined;
    if (!fileUrl && result.data instanceof Uint8Array && result.data.length < 5 * 1024 * 1024) {
      // Convert to base64 for direct download (only for files < 5MB)
      const binary = result.data;
      let binaryStr = '';
      for (let i = 0; i < binary.length; i++) {
        binaryStr += String.fromCharCode(binary[i]);
      }
      downloadData = btoa(binaryStr);
    }

    return c.json({
      jobId,
      status: 'done',
      format,
      fileUrl,
      fileKey,
      mimeType: result.mimeType,
      extension: result.extension,
      size: result.data instanceof Uint8Array ? result.data.length : (result.data as string).length,
      preview: previewData,
      downloadBase64: downloadData, // For direct download if R2 not configured
      downloadUrl: fileUrl ? `/api/export/download/${jobId}` : undefined
    });

  } catch (err: any) {
    console.error('Export error', err);
    
    await db.update(schema.exportJobs).set({
      status: 'failed',
      completedAt: nowTimestamp()
    }).where(eq(schema.exportJobs.id, jobId));

    return c.json({ error: 'Export failed: ' + err.message, jobId }, 500);
  }
});

// GET /api/export/jobs/:jobId
exportRoutes.get('/jobs/:jobId', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const jobId = c.req.param('jobId');

  const job = await db.select().from(schema.exportJobs).where(and(eq(schema.exportJobs.id, jobId), eq(schema.exportJobs.userId, user.userId))).limit(1);
  if (job.length === 0) return c.json({ error: 'Job not found' }, 404);

  return c.json({ job: job[0] });
});

// GET /api/export/download/:jobId - Download file from R2
exportRoutes.get('/download/:jobId', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const jobId = c.req.param('jobId');

  const job = await db.select().from(schema.exportJobs).where(and(eq(schema.exportJobs.id, jobId), eq(schema.exportJobs.userId, user.userId))).limit(1);
  if (job.length === 0) return c.json({ error: 'Job not found' }, 404);

  const jobData = job[0];
  if (jobData.status !== 'done' || !jobData.fileUrl) {
    return c.json({ error: 'File not ready or not found', status: jobData.status }, 404);
  }

  if (!c.env.R2) {
    return c.json({ error: 'R2 not configured' }, 500);
  }

  try {
    const object = await c.env.R2.get(jobData.fileUrl);
    if (!object) return c.json({ error: 'File not found in storage' }, 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    // Ensure download
    const project = await db.select().from(schema.projects).where(eq(schema.projects.id, jobData.projectId)).limit(1);
    const fileName = `${project[0]?.title || 'export'}.${jobData.format}`;
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    return new Response(object.body, { headers });
  } catch (e: any) {
    return c.json({ error: 'Download failed: ' + e.message }, 500);
  }
});

// GET /api/export/:projectId/history - List export history
exportRoutes.get('/:projectId/history', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const projectId = c.req.param('projectId');

  const project = await db.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, user.userId))).limit(1);
  if (project.length === 0) return c.json({ error: 'Project not found' }, 404);

  const jobs = await db.select().from(schema.exportJobs).where(and(eq(schema.exportJobs.projectId, projectId), eq(schema.exportJobs.userId, user.userId))).orderBy(schema.exportJobs.createdAt);

  return c.json({ jobs: jobs.reverse() }); // Newest first
});

// DELETE /api/export/jobs/:jobId - Delete export job and file
exportRoutes.delete('/jobs/:jobId', async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const jobId = c.req.param('jobId');

  const job = await db.select().from(schema.exportJobs).where(and(eq(schema.exportJobs.id, jobId), eq(schema.exportJobs.userId, user.userId))).limit(1);
  if (job.length === 0) return c.json({ error: 'Job not found' }, 404);

  // Delete from R2 if exists
  if (job[0].fileUrl && c.env.R2) {
    try {
      await c.env.R2.delete(job[0].fileUrl);
    } catch (e) {
      console.error('R2 delete error', e);
    }
  }

  await db.delete(schema.exportJobs).where(eq(schema.exportJobs.id, jobId));

  return c.json({ success: true });
});

export default exportRoutes;
