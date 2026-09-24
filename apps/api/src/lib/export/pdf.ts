// PDF Generator using pdf-lib (works in Cloudflare Workers)
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { tiptapToPlainText, type ExportChapter, type ExportProject } from './utils';

export interface PdfOptions {
  includeFrontMatter?: boolean;
  includeToc?: boolean;
  style?: 'modern' | 'classic' | 'minimal';
  fontSize?: number;
  lineSpacing?: number;
  authorName?: string;
}

export async function generatePdf(
  project: ExportProject,
  chapters: ExportChapter[],
  options: PdfOptions = {}
): Promise<Uint8Array> {
  const {
    includeFrontMatter = true,
    includeToc = true,
    style = 'modern',
    fontSize = 12,
    lineSpacing = 1.5,
    authorName = project.authorName || 'Tác giả'
  } = options;

  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const pageWidth = 595; // A4 width in points
  const pageHeight = 842; // A4 height
  const margin = 60;
  const contentWidth = pageWidth - 2 * margin;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addNewPage = () => {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    // Add page number
    const pageNum = pdfDoc.getPageCount();
    currentPage.drawText(`${pageNum}`, {
      x: pageWidth / 2 - 10,
      y: 30,
      size: 9,
      font: timesRoman,
      color: rgb(0.5, 0.5, 0.5)
    });
    return currentPage;
  };

  const drawTextWrapped = (
    text: string,
    opts: {
      font: any;
      size: number;
      color?: any;
      lineHeight?: number;
      indent?: number;
    }
  ) => {
    const { font, size, color = rgb(0, 0, 0), lineHeight = 1.5, indent = 0 } = opts;
    const words = text.split(' ');
    let line = '';
    
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      
      if (testWidth > contentWidth - indent && line) {
        // Draw current line
        if (y < margin + 40) addNewPage();
        
        currentPage.drawText(line, {
          x: margin + indent,
          y,
          size,
          font,
          color
        });
        y -= size * lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    
    // Draw remaining
    if (line) {
      if (y < margin + 40) addNewPage();
      currentPage.drawText(line, {
        x: margin + indent,
        y,
        size,
        font,
        color
      });
      y -= size * lineHeight;
    }
  };

  // Styles based on template
  const styles = {
    modern: {
      titleSize: 28,
      subtitleSize: 18,
      headingSize: 20,
      bodySize: fontSize,
      titleColor: rgb(0.2, 0.2, 0.8),
      headingColor: rgb(0.1, 0.1, 0.1)
    },
    classic: {
      titleSize: 24,
      subtitleSize: 16,
      headingSize: 18,
      bodySize: fontSize,
      titleColor: rgb(0, 0, 0),
      headingColor: rgb(0, 0, 0)
    },
    minimal: {
      titleSize: 22,
      subtitleSize: 14,
      headingSize: 16,
      bodySize: fontSize,
      titleColor: rgb(0.3, 0.3, 0.3),
      headingColor: rgb(0.2, 0.2, 0.2)
    }
  };

  const s = styles[style];

  // Front Matter
  if (includeFrontMatter) {
    // Title
    y = pageHeight / 2 + 100;
    const titleLines = project.title.split(' ');
    let titleLine = '';
    for (const word of titleLines) {
      const test = titleLine ? `${titleLine} ${word}` : word;
      if (timesBold.widthOfTextAtSize(test, s.titleSize) > contentWidth && titleLine) {
        currentPage.drawText(titleLine, {
          x: margin + (contentWidth - timesBold.widthOfTextAtSize(titleLine, s.titleSize)) / 2,
          y,
          size: s.titleSize,
          font: timesBold,
          color: s.titleColor
        });
        y -= s.titleSize * 1.2;
        titleLine = word;
      } else {
        titleLine = test;
      }
    }
    if (titleLine) {
      currentPage.drawText(titleLine, {
        x: margin + (contentWidth - timesBold.widthOfTextAtSize(titleLine, s.titleSize)) / 2,
        y,
        size: s.titleSize,
        font: timesBold,
        color: s.titleColor
      });
      y -= s.titleSize * 1.5;
    }

    if (project.subtitle) {
      currentPage.drawText(project.subtitle, {
        x: margin + (contentWidth - timesRoman.widthOfTextAtSize(project.subtitle, s.subtitleSize)) / 2,
        y,
        size: s.subtitleSize,
        font: timesItalic,
        color: rgb(0.4, 0.4, 0.4)
      });
      y -= s.subtitleSize * 2;
    }

    if (authorName) {
      y -= 40;
      currentPage.drawText(authorName, {
        x: margin + (contentWidth - timesRoman.widthOfTextAtSize(authorName, 14)) / 2,
        y,
        size: 14,
        font: timesRoman,
        color: rgb(0.3, 0.3, 0.3)
      });
      y -= 30;
    }

    if (project.description) {
      y -= 20;
      drawTextWrapped(project.description, {
        font: timesItalic,
        size: 11,
        color: rgb(0.5, 0.5, 0.5),
        lineHeight: 1.4
      });
    }

    // New page after front matter
    addNewPage();
    y = pageHeight - margin;
  }

  // Table of Contents
  if (includeToc && chapters.length > 0) {
    currentPage.drawText('Mục lục', {
      x: margin,
      y,
      size: s.headingSize,
      font: timesBold,
      color: s.headingColor
    });
    y -= s.headingSize * 1.5;

    chapters.forEach((ch, idx) => {
      if (y < margin + 20) addNewPage();
      
      const num = `${idx + 1}.`;
      currentPage.drawText(num, {
        x: margin,
        y,
        size: s.bodySize,
        font: timesRoman,
        color: rgb(0, 0, 0)
      });

      const titleX = margin + 25;
      const maxTitleWidth = contentWidth - 50;
      let title = ch.title;
      // Truncate if too long
      while (timesRoman.widthOfTextAtSize(title, s.bodySize) > maxTitleWidth && title.length > 10) {
        title = title.slice(0, -4) + '...';
      }

      currentPage.drawText(title, {
        x: titleX,
        y,
        size: s.bodySize,
        font: timesRoman,
        color: rgb(0, 0, 0)
      });

      // Dots
      const titleWidth = timesRoman.widthOfTextAtSize(title, s.bodySize);
      const dotsStart = titleX + titleWidth + 5;
      const dotsEnd = pageWidth - margin - 20;
      if (dotsEnd > dotsStart) {
        const dotWidth = timesRoman.widthOfTextAtSize('.', s.bodySize);
        const numDots = Math.floor((dotsEnd - dotsStart) / dotWidth);
        currentPage.drawText('.'.repeat(numDots), {
          x: dotsStart,
          y,
          size: s.bodySize,
          font: timesRoman,
          color: rgb(0.7, 0.7, 0.7)
        });
      }

      y -= s.bodySize * 1.6;
    });

    addNewPage();
  }

  // Chapters
  chapters
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((chapter, idx) => {
      // Chapter title
      if (y < margin + 100) addNewPage();

      const chapterNum = `Chương ${idx + 1}`;
      currentPage.drawText(chapterNum, {
        x: margin,
        y,
        size: 10,
        font: timesRoman,
        color: rgb(0.5, 0.5, 0.5)
      });
      y -= 16;

      drawTextWrapped(chapter.title, {
        font: timesBold,
        size: s.headingSize,
        color: s.headingColor,
        lineHeight: 1.2
      });
      y -= 10;

      // Decorative line
      currentPage.drawLine({
        start: { x: margin, y },
        end: { x: margin + 50, y },
        thickness: 2,
        color: s.titleColor
      });
      y -= 20;

      // Chapter content
      const plainText = tiptapToPlainText(chapter.content);
      if (plainText) {
        const paragraphs = plainText.split('\n\n').filter(p => p.trim());
        
        for (const para of paragraphs) {
          if (!para.trim()) continue;
          
          // Check if paragraph is heading-like (short and maybe all caps or starts with #)
          const isHeading = para.length < 100 && (para.startsWith('#') || para === para.toUpperCase());
          
          if (isHeading) {
            if (y < margin + 40) addNewPage();
            drawTextWrapped(para.replace(/^#+\s*/, ''), {
              font: timesBold,
              size: s.bodySize + 2,
              color: s.headingColor,
              lineHeight: 1.3
            });
            y -= 8;
          } else {
            drawTextWrapped(para, {
              font: timesRoman,
              size: s.bodySize,
              color: rgb(0.1, 0.1, 0.1),
              lineHeight: lineSpacing,
              indent: s.bodySize * 2 // First line indent
            });
            y -= 4; // Extra space between paragraphs
          }
        }
      } else {
        drawTextWrapped('(Chưa có nội dung)', {
          font: timesItalic,
          size: s.bodySize - 1,
          color: rgb(0.6, 0.6, 0.6),
          lineHeight: lineSpacing
        });
      }

      // Page break after each chapter (except last)
      if (idx < chapters.length - 1) {
        addNewPage();
      }
    });

  // Footer on all pages - add page numbers to existing pages
  const pages = pdfDoc.getPages();
  pages.forEach((page, idx) => {
    if (idx === 0 && includeFrontMatter) return; // Skip title page
    page.drawText(`${idx + 1}`, {
      x: pageWidth / 2 - 5,
      y: 30,
      size: 9,
      font: timesRoman,
      color: rgb(0.5, 0.5, 0.5)
    });
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
