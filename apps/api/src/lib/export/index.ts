export * from './utils';
export * from './pdf';
export * from './docx';
export * from './epub';
export * from './markdown';

import { generatePdf, type PdfOptions } from './pdf';
import { generateDocx, type DocxOptions } from './docx';
import { generateEpub, type EpubOptions } from './epub';
import { generateMarkdown, generateTxt, generateHtml, type MarkdownOptions } from './markdown';
import type { ExportProject, ExportChapter } from './utils';

export type ExportFormat = 'pdf' | 'docx' | 'epub' | 'md' | 'html' | 'txt' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeFrontMatter?: boolean;
  includeToc?: boolean;
  style?: 'modern' | 'classic' | 'minimal';
  authorName?: string;
  fontSize?: number;
  lineSpacing?: number;
  language?: string;
  chapterIds?: string[]; // if specified, only export these chapters
}

export async function generateExport(
  project: ExportProject,
  chapters: ExportChapter[],
  options: ExportOptions
): Promise<{ data: Uint8Array | string; mimeType: string; extension: string }> {
  // Filter chapters if chapterIds specified
  let filteredChapters = chapters;
  if (options.chapterIds && options.chapterIds.length > 0) {
    filteredChapters = chapters.filter(ch => options.chapterIds!.includes(ch.id));
  }

  filteredChapters = filteredChapters.sort((a, b) => a.orderIndex - b.orderIndex);

  switch (options.format) {
    case 'pdf': {
      const pdfOptions: PdfOptions = {
        includeFrontMatter: options.includeFrontMatter,
        includeToc: options.includeToc,
        style: options.style,
        authorName: options.authorName,
        fontSize: options.fontSize,
        lineSpacing: options.lineSpacing
      };
      const data = await generatePdf(project, filteredChapters, pdfOptions);
      return {
        data,
        mimeType: 'application/pdf',
        extension: 'pdf'
      };
    }

    case 'docx': {
      const docxOptions: DocxOptions = {
        includeFrontMatter: options.includeFrontMatter,
        includeToc: options.includeToc,
        style: options.style,
        authorName: options.authorName
      };
      const data = await generateDocx(project, filteredChapters, docxOptions);
      return {
        data,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx'
      };
    }

    case 'epub': {
      const epubOptions: EpubOptions = {
        includeFrontMatter: options.includeFrontMatter,
        includeToc: options.includeToc,
        authorName: options.authorName,
        language: options.language
      };
      const data = await generateEpub(project, filteredChapters, epubOptions);
      return {
        data,
        mimeType: 'application/epub+zip',
        extension: 'epub'
      };
    }

    case 'md': {
      const mdOptions: MarkdownOptions = {
        includeFrontMatter: options.includeFrontMatter,
        includeToc: options.includeToc,
        authorName: options.authorName
      };
      const data = generateMarkdown(project, filteredChapters, mdOptions);
      return {
        data,
        mimeType: 'text/markdown',
        extension: 'md'
      };
    }

    case 'html': {
      const htmlOptions = {
        includeFrontMatter: options.includeFrontMatter,
        includeToc: options.includeToc,
        authorName: options.authorName,
        style: options.style
      };
      const data = generateHtml(project, filteredChapters, htmlOptions);
      return {
        data,
        mimeType: 'text/html',
        extension: 'html'
      };
    }

    case 'txt': {
      const txtOptions: MarkdownOptions = {
        includeFrontMatter: options.includeFrontMatter,
        includeToc: options.includeToc,
        authorName: options.authorName
      };
      const data = generateTxt(project, filteredChapters, txtOptions);
      return {
        data,
        mimeType: 'text/plain',
        extension: 'txt'
      };
    }

    case 'json':
    default: {
      const jsonData = JSON.stringify(
        {
          project,
          chapters: filteredChapters,
          exportedAt: new Date().toISOString(),
          format: options.format
        },
        null,
        2
      );
      return {
        data: jsonData,
        mimeType: 'application/json',
        extension: 'json'
      };
    }
  }
}
