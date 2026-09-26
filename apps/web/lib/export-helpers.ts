// Helpers for parsing novel chapter content and generating publication-ready layouts

export function parseChapterParagraphs(rawContent: string): string[] {
  if (!rawContent) return [];

  // 1. Try parsing TipTap JSON format
  try {
    const json = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    if (json && json.type === 'doc' && Array.isArray(json.content)) {
      const paragraphs: string[] = [];
      const extractText = (node: any): string => {
        if (!node) return '';
        if (typeof node === 'string') return node;
        if (node.text) return node.text;
        if (Array.isArray(node.content)) {
          return node.content.map(extractText).join('');
        }
        return '';
      };

      for (const node of json.content) {
        const text = extractText(node).trim();
        if (text) paragraphs.push(text);
      }
      if (paragraphs.length > 0) return paragraphs;
    }
  } catch {}

  // 2. Try parsing HTML tags (e.g. <p>...</p>, <div>...</div>, <h1-6>)
  if (/<[a-z][\s\S]*>/i.test(rawContent)) {
    const cleaned = rawContent
      .replace(/<\/?(p|div|h[1-6]|li|blockquote)[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) return lines;
  }

  // 3. Fallback: split by newlines
  return rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}

export function generatePrintableBookHtml(
  projectTitle: string,
  authorName: string = '',
  chapters: Array<{ id: string; title: string; content: string; orderIndex?: number }>,
  options: {
    style?: 'modern' | 'classic' | 'minimal';
    includeFrontMatter?: boolean;
    includeToc?: boolean;
  } = {}
): string {
  const { style = 'modern', includeFrontMatter = true, includeToc = true } = options;

  const fontFamilies = {
    modern: `'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif`,
    classic: `'Times New Roman', Times, Georgia, serif`,
    minimal: `'Inter', -apple-system, sans-serif`
  };

  const selectedFont = fontFamilies[style] || fontFamilies.classic;

  const escapeHtml = (str: string) => (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let bodyContent = '';

  // 1. Cover Page / Front Matter
  if (includeFrontMatter) {
    bodyContent += `
      <section class="cover-page">
        <div class="cover-container">
          <div class="decorative-line top-line"></div>
          <h1 class="book-title">${escapeHtml(projectTitle)}</h1>
          ${authorName ? `<div class="author-name">Tác giả: ${escapeHtml(authorName)}</div>` : ''}
          <div class="publisher-mark">Bản thảo xuất bản từ Novelist App • ${new Date().toLocaleDateString('vi-VN')}</div>
          <div class="decorative-line bottom-line"></div>
        </div>
      </section>
      <div class="page-break"></div>
    `;
  }

  // 2. Table of Contents
  if (includeToc && chapters.length > 0) {
    bodyContent += `
      <section class="toc-page">
        <h2 class="toc-heading">MỤC LỤC</h2>
        <div class="toc-list">
          ${chapters.map((ch, idx) => `
            <div class="toc-item">
              <span class="toc-title">${escapeHtml(ch.title || `Chương ${idx + 1}`)}</span>
              <span class="toc-dots"></span>
              <span class="toc-page-num">${idx + 1}</span>
            </div>
          `).join('')}
        </div>
      </section>
      <div class="page-break"></div>
    `;
  }

  // 3. Chapters
  chapters.forEach((ch, idx) => {
    const paragraphs = parseChapterParagraphs(ch.content);
    bodyContent += `
      <article class="chapter-article">
        <header class="chapter-header">
          <h2 class="chapter-title">${escapeHtml(ch.title || `Chương ${idx + 1}`)}</h2>
        </header>
        <div class="chapter-body">
          ${paragraphs.length > 0
            ? paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('\n')
            : '<p class="empty-chapter"><em>(Chương này chưa có nội dung)</em></p>'
          }
        </div>
      </article>
      ${idx < chapters.length - 1 ? '<div class="page-break"></div>' : ''}
    `;
  });

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectTitle)} - Bản thảo PDF / In ấn</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 25mm 20mm 25mm 20mm;
      @bottom-right {
        content: counter(page);
        font-family: ${selectedFont};
        font-size: 9pt;
        color: #666;
      }
      @top-center {
        content: "${escapeHtml(projectTitle)}";
        font-family: ${selectedFont};
        font-size: 8pt;
        color: #999;
        font-style: italic;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: ${selectedFont};
      font-size: 11pt;
      line-height: 1.75;
      color: #1a1a1a;
      background-color: #f8fafc;
      padding: 24px;
    }

    .book-wrapper {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 60px 50px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border-radius: 8px;
    }

    .action-bar {
      position: sticky;
      top: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      z-index: 1000;
    }

    .action-bar h3 {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-group {
      display: flex;
      gap: 10px;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 13px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #2563eb;
      color: #fff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }

    .btn-secondary {
      background: #334155;
      color: #fff;
    }
    .btn-secondary:hover {
      background: #1e293b;
    }

    .page-break {
      page-break-before: always;
      break-before: page;
      height: 0;
    }

    .cover-page {
      min-height: 70vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 80px 20px 40px;
    }

    .cover-container {
      width: 100%;
      max-width: 600px;
    }

    .decorative-line {
      height: 2px;
      background: linear-gradient(90deg, transparent, #2563eb, transparent);
      margin: 30px auto;
      width: 60%;
    }

    .book-title {
      font-size: 28pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      line-height: 1.25;
      margin-bottom: 20px;
    }

    .author-name {
      font-size: 14pt;
      color: #475569;
      font-style: italic;
      margin-bottom: 40px;
    }

    .publisher-mark {
      font-size: 9pt;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .toc-page {
      padding: 40px 0 20px;
    }

    .toc-heading {
      text-align: center;
      font-size: 16pt;
      font-weight: 700;
      letter-spacing: 2px;
      margin-bottom: 30px;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 12px;
    }

    .toc-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .toc-item {
      display: flex;
      align-items: baseline;
      font-size: 11pt;
    }

    .toc-title {
      white-space: nowrap;
      font-weight: 500;
      color: #1e293b;
    }

    .toc-dots {
      flex: 1;
      border-bottom: 1px dotted #cbd5e1;
      margin: 0 10px;
    }

    .toc-page-num {
      color: #64748b;
      font-size: 10pt;
    }

    .chapter-article {
      padding-top: 30px;
      margin-bottom: 40px;
    }

    .chapter-header {
      text-align: center;
      margin-bottom: 35px;
    }

    .chapter-label {
      font-size: 9pt;
      font-weight: 700;
      color: #2563eb;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .chapter-title {
      font-size: 18pt;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
    }

    .chapter-body p {
      text-align: justify;
      text-justify: inter-word;
      text-indent: 1.5em;
      margin-bottom: 0.8em;
      color: #1e293b;
    }

    @media print {
      body {
        background: #fff !important;
        padding: 0 !important;
      }
      .book-wrapper {
        box-shadow: none !important;
        padding: 0 !important;
        border-radius: 0 !important;
        max-width: 100% !important;
      }
      .action-bar {
        display: none !important;
      }
      .page-break {
        page-break-before: always !important;
        break-before: page !important;
      }
      .chapter-article {
        page-break-before: always !important;
        break-before: page !important;
      }
      .chapter-article:first-of-type {
        page-break-before: auto !important;
      }
    }
  </style>
</head>
<body>
  <div class="book-wrapper">
    <div class="action-bar">
      <h3>📖 Bản thảo chuẩn in ấn A4 - ${escapeHtml(projectTitle)}</h3>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="window.print()">🖨️ Lưu file PDF / In sách</button>
        <button class="btn btn-secondary" onclick="window.close()">Đóng cửa sổ</button>
      </div>
    </div>
    ${bodyContent}
  </div>
</body>
</html>`;
}
