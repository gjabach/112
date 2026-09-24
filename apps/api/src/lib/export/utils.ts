// Export utilities - Convert Tiptap JSON to plain formats
export interface ExportChapter {
  id: string;
  title: string;
  content: string | null;
  contentFormat: string;
  orderIndex: number;
  summary?: string | null;
}

export interface ExportProject {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  genre?: string | null;
  authorName?: string;
}

export function tiptapToPlainText(content: string | null): string {
  if (!content) return '';
  
  try {
    const json = JSON.parse(content);
    return extractPlainText(json);
  } catch {
    // If not JSON, treat as HTML or plain text - strip tags
    return content.replace(/<[^>]*>/g, '').trim();
  }
}

function extractPlainText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return node.text;
  
  let text = '';
  if (Array.isArray(node.content)) {
    for (let i = 0; i < node.content.length; i++) {
      const child = node.content[i];
      const childText = extractPlainText(child);
      
      // Add line breaks for block elements
      if (child.type === 'paragraph' || child.type === 'heading') {
        text += childText + '\n\n';
      } else if (child.type === 'hardBreak') {
        text += '\n';
      } else {
        text += childText;
        // Add space between inline elements if needed
        if (i < node.content.length - 1 && childText && !childText.endsWith(' ') && !childText.endsWith('\n')) {
          const next = node.content[i + 1];
          if (next?.text && !next.text.startsWith(' ') && !next.text.startsWith('\n')) {
            // Check if we need space - simple heuristic
            if (child.type === 'text' && next.type === 'text') {
              // Don't add extra space, tiptap already handles it
            }
          }
        }
      }
    }
  }
  
  return text;
}

export function tiptapToHtml(content: string | null): string {
  if (!content) return '<p></p>';
  
  try {
    const json = JSON.parse(content);
    return convertToHtml(json);
  } catch {
    // If already HTML or plain, wrap in p
    if (content.trim().startsWith('<')) {
      return content;
    }
    return `<p>${escapeHtml(content)}</p>`;
  }
}

function convertToHtml(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return escapeHtml(node);
  if (node.text) {
    let text = escapeHtml(node.text);
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        if (mark.type === 'italic') text = `<em>${text}</em>`;
        if (mark.type === 'underline') text = `<u>${text}</u>`;
        if (mark.type === 'strike') text = `<s>${text}</s>`;
        if (mark.type === 'code') text = `<code>${text}</code>`;
        if (mark.type === 'highlight') text = `<mark>${text}</mark>`;
        if (mark.type === 'link') text = `<a href="${mark.attrs?.href || '#'}">${text}</a>`;
      }
    }
    return text;
  }

  let html = '';
  const content = node.content ? node.content.map(convertToHtml).join('') : '';

  switch (node.type) {
    case 'doc':
      return content;
    case 'paragraph':
      return `<p>${content || '<br>'}</p>`;
    case 'heading':
      const level = node.attrs?.level || 1;
      return `<h${level}>${content}</h${level}>`;
    case 'blockquote':
      return `<blockquote>${content}</blockquote>`;
    case 'bulletList':
      return `<ul>${content}</ul>`;
    case 'orderedList':
      return `<ol>${content}</ol>`;
    case 'listItem':
      return `<li>${content}</li>`;
    case 'codeBlock':
      return `<pre><code>${content}</code></pre>`;
    case 'horizontalRule':
      return `<hr/>`;
    case 'hardBreak':
      return `<br/>`;
    case 'image':
      return `<img src="${node.attrs?.src || ''}" alt="${node.attrs?.alt || ''}" />`;
    default:
      return content;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateFrontMatter(project: ExportProject, format: 'html' | 'text' | 'markdown' = 'html'): string {
  if (format === 'html') {
    return `
      <div class="front-matter title-page" style="text-align: center; margin: 100px 0;">
        <h1 style="font-size: 2.5em; margin-bottom: 0.2em;">${escapeHtml(project.title)}</h1>
        ${project.subtitle ? `<h2 style="font-size: 1.5em; color: #666; font-weight: normal; margin-top: 0;">${escapeHtml(project.subtitle)}</h2>` : ''}
        ${project.authorName ? `<p style="margin-top: 2em; font-size: 1.2em;">${escapeHtml(project.authorName)}</p>` : ''}
        ${project.genre ? `<p style="margin-top: 1em; color: #888;"><em>${escapeHtml(project.genre)}</em></p>` : ''}
      </div>
      ${project.description ? `<div class="description" style="margin: 50px 0; text-align: center; font-style: italic;"><p>${escapeHtml(project.description)}</p></div>` : ''}
      <div style="page-break-after: always;"></div>
    `;
  } else if (format === 'markdown') {
    return `# ${project.title}\n\n${project.subtitle ? `## ${project.subtitle}\n\n` : ''}${project.authorName ? `**Tác giả:** ${project.authorName}\n\n` : ''}${project.description ? `${project.description}\n\n---\n\n` : ''}`;
  } else {
    return `${project.title}\n${project.subtitle ? project.subtitle + '\n' : ''}${project.authorName ? `Tác giả: ${project.authorName}\n` : ''}${project.description ? `\n${project.description}\n\n` : ''}${'='.repeat(50)}\n\n`;
  }
}

export function generateToc(chapters: ExportChapter[], format: 'html' | 'text' | 'markdown' = 'html'): string {
  if (format === 'html') {
    let toc = `<div class="toc"><h2>Mục lục</h2><ul>`;
    chapters.forEach((ch, idx) => {
      toc += `<li><a href="#chapter-${idx + 1}">${idx + 1}. ${escapeHtml(ch.title)}</a></li>`;
    });
    toc += `</ul></div><div style="page-break-after: always;"></div>`;
    return toc;
  } else if (format === 'markdown') {
    let toc = `## Mục lục\n\n`;
    chapters.forEach((ch, idx) => {
      toc += `${idx + 1}. [${ch.title}](#chapter-${idx + 1})\n`;
    });
    toc += `\n---\n\n`;
    return toc;
  } else {
    let toc = `MỤC LỤC\n\n`;
    chapters.forEach((ch, idx) => {
      toc += `${idx + 1}. ${ch.title}\n`;
    });
    toc += `\n${'='.repeat(30)}\n\n`;
    return toc;
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
