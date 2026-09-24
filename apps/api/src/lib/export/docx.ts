// DOCX Generator using docx library (works in Cloudflare Workers)
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, TabStopType, TabStopPosition } from 'docx';
import { tiptapToPlainText, type ExportChapter, type ExportProject } from './utils';

export interface DocxOptions {
  includeFrontMatter?: boolean;
  includeToc?: boolean;
  style?: 'modern' | 'classic' | 'minimal';
  authorName?: string;
}

export async function generateDocx(
  project: ExportProject,
  chapters: ExportChapter[],
  options: DocxOptions = {}
): Promise<Uint8Array> {
  const {
    includeFrontMatter = true,
    includeToc = true,
    style = 'modern',
    authorName = project.authorName || 'Tác giả'
  } = options;

  const children: Paragraph[] = [];

  // Styles
  const titleStyle = {
    modern: { size: 48, color: '2E5090', bold: true },
    classic: { size: 36, color: '000000', bold: true },
    minimal: { size: 32, color: '333333', bold: true }
  }[style];

  // Front Matter
  if (includeFrontMatter) {
    // Title
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({
            text: project.title,
            bold: titleStyle.bold,
            size: titleStyle.size,
            color: titleStyle.color
          })
        ],
        heading: HeadingLevel.TITLE
      })
    );

    if (project.subtitle) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: project.subtitle,
              size: 28,
              color: '666666',
              italics: true
            })
          ]
        })
      );
    }

    if (authorName) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
          children: [
            new TextRun({
              text: authorName,
              size: 24,
              color: '333333'
            })
          ]
        })
      );
    }

    if (project.genre) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: project.genre,
              size: 20,
              color: '888888',
              italics: true
            })
          ]
        })
      );
    }

    if (project.description) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 300, after: 300 },
          children: [
            new TextRun({
              text: project.description,
              size: 20,
              color: '555555',
              italics: true
            })
          ]
        })
      );
    }

    // Page break after front matter
    children.push(
      new Paragraph({
        children: [new TextRun({ text: '', break: 1 })],
        pageBreakBefore: false
      }),
      new Paragraph({
        children: [],
        pageBreakBefore: true
      })
    );
  }

  // Table of Contents
  if (includeToc && chapters.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
        children: [
          new TextRun({
            text: 'Mục lục',
            bold: true,
            size: 32,
            color: '000000'
          })
        ]
      })
    );

    chapters
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .forEach((ch, idx) => {
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            tabStops: [
              {
                type: TabStopType.RIGHT,
                position: TabStopPosition.MAX
              }
            ],
            children: [
              new TextRun({
                text: `${idx + 1}. ${ch.title}`,
                size: 22
              }),
              new TextRun({
                text: '\t',
                size: 22
              })
            ]
          })
        );
      });

    children.push(
      new Paragraph({
        children: [],
        pageBreakBefore: true
      })
    );
  }

  // Chapters
  chapters
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((chapter, idx) => {
      // Chapter number
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: `Chương ${idx + 1}`,
              size: 20,
              color: '888888',
              smallCaps: true
            })
          ]
        })
      );

      // Chapter title
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 100, after: 200 },
          children: [
            new TextRun({
              text: chapter.title,
              bold: true,
              size: 32,
              color: style === 'modern' ? '2E5090' : '000000'
            })
          ],
          border: {
            bottom: {
              color: style === 'modern' ? '2E5090' : 'CCCCCC',
              space: 1,
              size: 6,
              style: 'single' as any
            }
          }
        })
      );

      // Chapter content
      const plainText = tiptapToPlainText(chapter.content);
      if (plainText) {
        const paragraphs = plainText.split('\n\n').filter(p => p.trim());
        
        for (const paraText of paragraphs) {
          if (!paraText.trim()) continue;

          // Detect heading
          const isHeading = paraText.length < 100 && (paraText.startsWith('#') || paraText === paraText.toUpperCase());
          
          if (isHeading) {
            children.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
                children: [
                  new TextRun({
                    text: paraText.replace(/^#+\s*/, ''),
                    bold: true,
                    size: 26
                  })
                ]
              })
            );
          } else {
            // Regular paragraph with first line indent
            children.push(
              new Paragraph({
                spacing: { after: 150, line: 360 }, // 1.5 line spacing
                indent: { firstLine: 720 }, // 0.5 inch indent
                alignment: AlignmentType.JUSTIFIED,
                children: [
                  new TextRun({
                    text: paraText,
                    size: 22, // 11pt
                    font: 'Times New Roman'
                  })
                ]
              })
            );
          }
        }
      } else {
        children.push(
          new Paragraph({
            spacing: { after: 150 },
            children: [
              new TextRun({
                text: '(Chưa có nội dung)',
                size: 20,
                color: '999999',
                italics: true
              })
            ]
          })
        );
      }

      // Page break after each chapter except last
      if (idx < chapters.length - 1) {
        children.push(
          new Paragraph({
            children: [],
            pageBreakBefore: true
          })
        );
      }
    });

  // Create document
  const doc = new Document({
    creator: authorName,
    title: project.title,
    description: project.description || '',
    keywords: project.genre || '',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children
      }
    ],
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 22
          },
          paragraph: {
            spacing: { line: 360 }
          }
        }
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            size: 48,
            bold: true,
            color: '2E5090'
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 }
          }
        }
      ]
    },
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal' as any,
              text: '%1.',
              alignment: AlignmentType.LEFT
            }
          ]
        }
      ]
    }
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
