import { tiptapToPlainText, tiptapToHtml, type ExportChapter, type ExportProject, generateFrontMatter, generateToc, escapeHtml } from './utils';

export interface MarkdownOptions {
  includeFrontMatter?: boolean;
  includeToc?: boolean;
  authorName?: string;
}

export function generateMarkdown(
  project: ExportProject,
  chapters: ExportChapter[],
  options: MarkdownOptions = {}
): string {
  const { includeFrontMatter = true, includeToc = true, authorName } = options;

  let md = '';

  if (includeFrontMatter) {
    md += generateFrontMatter({ ...project, authorName }, 'markdown');
  }

  if (includeToc) {
    md += generateToc(chapters, 'markdown');
  }

  chapters
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((chapter, idx) => {
      md += `## Chương ${idx + 1}: ${chapter.title}\n\n`;
      
      const plainText = tiptapToPlainText(chapter.content);
      if (plainText) {
        // Convert plain text paragraphs to markdown
        const paragraphs = plainText.split('\n\n').filter(p => p.trim());
        for (const para of paragraphs) {
          if (para.length < 100 && para === para.toUpperCase()) {
            md += `### ${para}\n\n`;
          } else {
            md += `${para}\n\n`;
          }
        }
      } else {
        md += `*(Chưa có nội dung)*\n\n`;
      }

      md += `---\n\n`;
    });

  return md;
}

export function generateTxt(
  project: ExportProject,
  chapters: ExportChapter[],
  options: MarkdownOptions = {}
): string {
  const { includeFrontMatter = true, includeToc = true, authorName } = options;

  let txt = '';

  if (includeFrontMatter) {
    txt += generateFrontMatter({ ...project, authorName }, 'text');
  }

  if (includeToc) {
    txt += generateToc(chapters, 'text');
  }

  chapters
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((chapter, idx) => {
      txt += `CHƯƠNG ${idx + 1}: ${chapter.title.toUpperCase()}\n`;
      txt += `${'='.repeat(50)}\n\n`;

      const plainText = tiptapToPlainText(chapter.content);
      if (plainText) {
        txt += `${plainText}\n\n`;
      } else {
        txt += `(Chưa có nội dung)\n\n`;
      }

      txt += `\n\n`;
    });

  return txt;
}

export function generateHtml(
  project: ExportProject,
  chapters: ExportChapter[],
  options: MarkdownOptions & { style?: string } = {}
): string {
  const { includeFrontMatter = true, includeToc = true, authorName, style = 'modern' } = options;

  const styles = {
    modern: `
      body { font-family: Georgia, serif; line-height: 1.8; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #333; }
      h1 { color: #2E5090; text-align: center; }
      h2 { color: #333; border-bottom: 2px solid #2E5090; padding-bottom: 10px; }
      .title-page { text-align: center; margin: 100px 0; }
      .chapter { margin: 60px 0; page-break-after: always; }
      .chapter-number { text-align: center; color: #888; text-transform: uppercase; letter-spacing: 0.1em; }
      p { text-align: justify; text-indent: 1.5em; margin: 0.8em 0; }
      blockquote { border-left: 3px solid #ccc; margin: 1em 2em; padding-left: 1em; font-style: italic; color: #555; }
    `,
    classic: `
      body { font-family: "Times New Roman", serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 40px; color: #000; }
      h1 { text-align: center; font-size: 2em; }
      h2 { font-size: 1.5em; margin-top: 2em; }
      .title-page { text-align: center; margin: 100px 0; }
      p { text-indent: 2em; margin: 0.5em 0; }
    `,
    minimal: `
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.7; max-width: 650px; margin: 0 auto; padding: 40px 20px; color: #222; }
      h1 { font-weight: 300; letter-spacing: -0.02em; }
      h2 { font-weight: 600; margin-top: 2em; }
      p { margin: 1em 0; }
    `
  };

  let html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(project.title)}</title>
  <style>${styles[style as keyof typeof styles] || styles.modern}</style>
</head>
<body>
`;

  if (includeFrontMatter) {
    html += generateFrontMatter({ ...project, authorName }, 'html');
  }

  if (includeToc) {
    html += generateToc(chapters, 'html');
  }

  chapters
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((chapter, idx) => {
      const htmlContent = tiptapToHtml(chapter.content);
      
      html += `
  <div class="chapter" id="chapter-${idx + 1}">
    <p class="chapter-number">Chương ${idx + 1}</p>
    <h2>${escapeHtml(chapter.title)}</h2>
    ${htmlContent}
  </div>
`;
    });

  html += `
</body>
</html>`;

  return html;
}
