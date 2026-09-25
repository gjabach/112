import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Footer,
  PageNumber
} from 'docx';

import { parseChapterParagraphs, generatePrintableBookHtml } from '@/lib/export-helpers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      format = 'docx',
      projectTitle = 'Tieu_Thuyet',
      authorName = '',
      chapters = [],
      options = {}
    } = body;

    const style = options.style || 'modern';
    const includeFrontMatter = options.includeFrontMatter ?? true;
    const includeToc = options.includeToc ?? true;

    // Filter & sort chapters
    const sortedChapters = [...chapters].sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));

    if (format === 'docx') {
      const docChildren: any[] = [];

      // 1. Front Matter / Title Page
      if (includeFrontMatter) {
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.TITLE,
            spacing: { before: 800, after: 300 },
            children: [
              new TextRun({
                text: projectTitle,
                size: 40,
                bold: true,
                font: 'Times New Roman'
              })
            ]
          }),
          ...(authorName
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 300 },
                  children: [
                    new TextRun({
                      text: `Tác giả: ${authorName}`,
                      size: 24,
                      italics: true,
                      font: 'Times New Roman'
                    })
                  ]
                })
              ]
            : []),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 },
            children: [
              new TextRun({
                text: `Xuất bản ngày ${new Date().toLocaleDateString('vi-VN')} qua Novelist`,
                size: 18,
                color: '888888',
                font: 'Times New Roman'
              })
            ]
          }),
          new Paragraph({ children: [new PageBreak()] })
        );
      }

      // 2. Table of Contents
      if (includeToc && sortedChapters.length > 0) {
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 400 },
            children: [
              new TextRun({
                text: 'MỤC LỤC',
                size: 28,
                bold: true,
                font: 'Times New Roman'
              })
            ]
          })
        );

        sortedChapters.forEach((ch: any, idx: number) => {
          docChildren.push(
            new Paragraph({
              spacing: { after: 140 },
              children: [
                new TextRun({
                  text: `${idx + 1}. ${ch.title || 'Chương'}`,
                  size: 22,
                  font: 'Times New Roman'
                })
              ]
            })
          );
        });

        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }

      // 3. Chapters
      sortedChapters.forEach((ch: any, idx: number) => {
        if (idx > 0 || includeFrontMatter || includeToc) {
          docChildren.push(new Paragraph({ children: [new PageBreak()] }));
        }

        // Chapter title
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 300 },
            children: [
              new TextRun({
                text: `Chương ${idx + 1}: ${ch.title || ''}`,
                size: 30,
                bold: true,
                font: 'Times New Roman'
              })
            ]
          })
        );

        // Paragraphs
        const paragraphs = parseChapterParagraphs(ch.content);
        if (paragraphs.length === 0) {
          docChildren.push(
            new Paragraph({
              spacing: { after: 160 },
              children: [new TextRun({ text: '', font: 'Times New Roman' })]
            })
          );
        } else {
          paragraphs.forEach((pText: string) => {
            docChildren.push(
              new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                indent: { firstLine: 720 }, // 0.5 inch first line indent
                spacing: { after: 120, line: 360 }, // 1.5 line spacing
                children: [
                  new TextRun({
                    text: pText,
                    size: 24, // 12pt
                    font: 'Times New Roman'
                  })
                ]
              })
            );
          });
        }
      });

      const doc = new Document({
        sections: [
          {
            properties: {},
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: 'Trang ',
                        size: 18,
                        color: '666666',
                        font: 'Times New Roman'
                      }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        size: 18,
                        color: '666666',
                        font: 'Times New Roman'
                      })
                    ]
                  })
                ]
              })
            },
            children: docChildren
          }
        ]
      });

      const buffer = await Packer.toBuffer(doc);
      const base64Data = buffer.toString('base64');

      return NextResponse.json({
        success: true,
        format: 'docx',
        extension: 'docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        downloadBase64: base64Data,
        size: buffer.length
      });
    }

    if (format === 'html' || format === 'pdf') {
      const htmlContent = generatePrintableBookHtml(projectTitle, authorName, sortedChapters, {
        style,
        includeFrontMatter,
        includeToc
      });

      return NextResponse.json({
        success: true,
        format,
        extension: 'html',
        mimeType: 'text/html;charset=utf-8',
        htmlContent,
        size: Buffer.byteLength(htmlContent, 'utf8')
      });
    }

    if (format === 'md') {
      let md = `# ${projectTitle}\n\n`;
      if (authorName) md += `*Tác giả: ${authorName}*\n\n`;
      if (includeToc) {
        md += `## Mục Lục\n\n`;
        sortedChapters.forEach((ch: any, idx: number) => {
          md += `${idx + 1}. [${ch.title}](#chuong-${idx + 1})\n`;
        });
        md += `\n---\n\n`;
      }
      sortedChapters.forEach((ch: any, idx: number) => {
        md += `## Chương ${idx + 1}: ${ch.title}\n\n`;
        const paras = parseChapterParagraphs(ch.content);
        md += paras.join('\n\n') + '\n\n---\n\n';
      });

      return NextResponse.json({
        success: true,
        format: 'md',
        extension: 'md',
        mimeType: 'text/markdown;charset=utf-8',
        textContent: md,
        size: Buffer.byteLength(md, 'utf8')
      });
    }

    // Default plain text
    let txt = `${projectTitle}\n${authorName ? `Tác giả: ${authorName}\n` : ''}\n====================\n\n`;
    sortedChapters.forEach((ch: any, idx: number) => {
      txt += `\n\n--- Chương ${idx + 1}: ${ch.title} ---\n\n`;
      const paras = parseChapterParagraphs(ch.content);
      txt += paras.join('\n\n') + '\n';
    });

    return NextResponse.json({
      success: true,
      format: 'txt',
      extension: 'txt',
      mimeType: 'text/plain;charset=utf-8',
      textContent: txt,
      size: Buffer.byteLength(txt, 'utf8')
    });
  } catch (error: any) {
    console.error('[Export API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi xử lý xuất bản tài liệu'
      },
      { status: 500 }
    );
  }
}
