// PDF Generator using pdf-lib and @pdf-lib/fontkit with Vietnamese Unicode support
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { tiptapToPlainText, type ExportChapter, type ExportProject } from './utils';

export interface PdfOptions {
  includeFrontMatter?: boolean;
  includeToc?: boolean;
  style?: 'modern' | 'classic' | 'minimal';
  fontSize?: number;
  lineSpacing?: number;
  authorName?: string;
  fontBytes?: Uint8Array | ArrayBuffer;
  boldFontBytes?: Uint8Array | ArrayBuffer;
}

let cachedRegularFont: ArrayBuffer | null = null;
let cachedBoldFont: ArrayBuffer | null = null;

async function loadUnicodeFonts(options: PdfOptions): Promise<{
  regularBytes?: ArrayBuffer;
  boldBytes?: ArrayBuffer;
}> {
  if (options.fontBytes) {
    return {
      regularBytes: options.fontBytes instanceof Uint8Array ? (options.fontBytes.buffer as ArrayBuffer) : (options.fontBytes as ArrayBuffer),
      boldBytes: options.boldFontBytes ? (options.boldFontBytes instanceof Uint8Array ? (options.boldFontBytes.buffer as ArrayBuffer) : (options.boldFontBytes as ArrayBuffer)) : undefined
    };
  }

  if (cachedRegularFont) {
    return { regularBytes: cachedRegularFont, boldBytes: cachedBoldFont || cachedRegularFont };
  }

  try {
    const [regRes, boldRes] = await Promise.all([
      fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf'),
      fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf')
    ]);

    if (regRes.ok) {
      cachedRegularFont = await regRes.arrayBuffer();
    }
    if (boldRes.ok) {
      cachedBoldFont = await boldRes.arrayBuffer();
    }
  } catch (e) {
    console.warn('[PDF] Failed to fetch Unicode font from CDN:', e);
  }

  return {
    regularBytes: cachedRegularFont || undefined,
    boldBytes: cachedBoldFont || cachedRegularFont || undefined
  };
}

// Fallback ASCII sanitizer used only when custom Unicode font cannot be loaded
function sanitizeToWinAnsi(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
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
  pdfDoc.registerFontkit(fontkit);

  let timesRoman: PDFFont;
  let timesBold: PDFFont;
  let timesItalic: PDFFont;
  let isUnicodeFont = false;

  const fontData = await loadUnicodeFonts(options);
  if (fontData.regularBytes) {
    try {
      timesRoman = await pdfDoc.embedFont(fontData.regularBytes);
      timesBold = fontData.boldBytes ? await pdfDoc.embedFont(fontData.boldBytes) : timesRoman;
      timesItalic = timesRoman;
      isUnicodeFont = true;
    } catch (e) {
      console.warn('[PDF] Could not embed custom font, falling back to StandardFonts:', e);
      timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    }
  } else {
    timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  }

  const safeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return isUnicodeFont ? text : sanitizeToWinAnsi(text);
  };

  const pageWidth = 595; // A4 width in points
  const pageHeight = 842; // A4 height
  const margin = 60;
  const contentWidth = pageWidth - 2 * margin;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addNewPage = () => {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
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
      font: PDFFont;
      size: number;
      color?: any;
      lineHeight?: number;
      indent?: number;
    }
  ) => {
    const { font, size, color = rgb(0, 0, 0), lineHeight = 1.5, indent = 0 } = opts;
    const cleanStr = safeText(text);
    const words = cleanStr.split(' ');
    let line = '';
    
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      
      if (testWidth > contentWidth - indent && line) {
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

  const s = styles[style] || styles.modern;

  // Front Matter
  if (includeFrontMatter) {
    y = pageHeight / 2 + 100;
    const titleLines = safeText(project.title).split(' ');
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
      const cleanSub = safeText(project.subtitle);
      currentPage.drawText(cleanSub, {
        x: margin + (contentWidth - timesRoman.widthOfTextAtSize(cleanSub, s.subtitleSize)) / 2,
        y,
        size: s.subtitleSize,
        font: timesItalic,
        color: rgb(0.4, 0.4, 0.4)
      });
      y -= s.subtitleSize * 2;
    }

    if (authorName) {
      const cleanAuthor = safeText(authorName);
      y -= 40;
      currentPage.drawText(cleanAuthor, {
        x: margin + (contentWidth - timesRoman.widthOfTextAtSize(cleanAuthor, 14)) / 2,
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

    addNewPage();
    y = pageHeight - margin;
  }

  // Table of Contents
  if (includeToc && chapters.length > 0) {
    const tocTitle = safeText('Mục lục');
    currentPage.drawText(tocTitle, {
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
      let title = safeText(ch.title);
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

      const titleWidth = timesRoman.widthOfTextAtSize(title, s.bodySize);
      const dotsStart = titleX + titleWidth + 5;
      const dotsEnd = pageWidth - margin - 20;
      if (dotsEnd > dotsStart) {
        const dotWidth = timesRoman.widthOfTextAtSize('.', s.bodySize);
        const numDots = Math.floor((dotsEnd - dotsStart) / dotWidth);
        if (numDots > 0) {
          currentPage.drawText('.'.repeat(numDots), {
            x: dotsStart,
            y,
            size: s.bodySize,
            font: timesRoman,
            color: rgb(0.7, 0.7, 0.7)
          });
        }
      }

      y -= s.bodySize * 1.6;
    });

    addNewPage();
  }

  // Chapters
  chapters
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((chapter, idx) => {
      if (y < margin + 100) addNewPage();

      const chapterNum = safeText(`Chương ${idx + 1}`);
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

      currentPage.drawLine({
        start: { x: margin, y },
        end: { x: margin + 50, y },
        thickness: 2,
        color: s.titleColor
      });
      y -= 20;

      const plainText = tiptapToPlainText(chapter.content);
      if (plainText) {
        const paragraphs = plainText.split('\n\n').filter(p => p.trim());
        
        for (const para of paragraphs) {
          if (!para.trim()) continue;
          
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
              indent: s.bodySize * 2
            });
            y -= 4;
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

      if (idx < chapters.length - 1) {
        addNewPage();
      }
    });

  // Footer on all pages
  const pages = pdfDoc.getPages();
  pages.forEach((page, idx) => {
    if (idx === 0 && includeFrontMatter) return;
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
