'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { Download, FileText, BookOpen, File, Code, FileJson, Check, Loader2, Printer } from 'lucide-react';
import { parseChapterParagraphs, generatePrintableBookHtml } from '@/lib/export-helpers';
import { fireConfetti } from '@/components/vfx/confetti';

interface ExportDialogProps {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters?: any[];
  initialFormat?: string;
}

const formats = [
  { id: 'pdf', name: 'PDF (Sách in)', desc: 'Bản in A4, layout sách, font tiếng Việt sắc nét, đánh số trang', icon: FileText, color: 'bg-red-500', ext: 'pdf' },
  { id: 'docx', name: 'DOCX (Word)', desc: 'Gửi nhà xuất bản, biên tập trong Word/Google Docs, giữ styles', icon: File, color: 'bg-blue-500', ext: 'docx' },
  { id: 'epub', name: 'EPUB (Ebook)', desc: 'Đọc trên Kindle, Kobo, điện thoại, máy tính bảng', icon: BookOpen, color: 'bg-green-500', ext: 'epub' },
  { id: 'html', name: 'HTML (Web)', desc: 'Website sách tĩnh hoặc đọc ngoại tuyến đầy đủ', icon: Code, color: 'bg-orange-500', ext: 'html' },
  { id: 'md', name: 'Markdown', desc: 'Lưu trữ Obsidian, Notion, GitHub', icon: FileText, color: 'bg-gray-700', ext: 'md' },
  { id: 'txt', name: 'Plain Text', desc: 'Văn bản thuần, nhẹ và tương thích mọi thiết bị', icon: FileText, color: 'bg-gray-500', ext: 'txt' },
  { id: 'json', name: 'JSON Backup', desc: 'Dữ liệu cấu trúc để import hoặc lập trình', icon: FileJson, color: 'bg-purple-500', ext: 'json' }
];

const styles = [
  { id: 'modern', name: 'Modern', desc: 'Hiện đại, sans-serif, màu thanh lịch', preview: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' },
  { id: 'classic', name: 'Classic', desc: 'Cổ điển, Times New Roman, chuẩn xuất bản', preview: 'bg-amber-50 border-amber-200' },
  { id: 'minimal', name: 'Minimal', desc: 'Tối giản, trắng đen, lề rộng thoáng đãng', preview: 'bg-white border-gray-200' }
];

export function ExportDialog({
  projectId,
  projectTitle,
  open,
  onOpenChange,
  chapters = [],
  initialFormat
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState(initialFormat || 'pdf');
  const [selectedStyle, setSelectedStyle] = useState<'modern' | 'classic' | 'minimal'>('classic');
  const [includeFrontMatter, setIncludeFrontMatter] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      if (initialFormat) {
        setSelectedFormat(initialFormat);
      }
      setSelectedChapters(chapters.map((c: any) => c.id));
      fetchHistory();

      // Read author name from user profile or localStorage
      try {
        const userStr = localStorage.getItem('novelist_current_user') || localStorage.getItem('auth-storage');
        if (userStr) {
          const parsed = JSON.parse(userStr);
          const name = parsed.name || parsed.state?.user?.name || '';
          if (name) setAuthorName(name);
        }
      } catch {}
    }
  }, [open, chapters, initialFormat]);

  const fetchHistory = async () => {
    try {
      const res = await apiFetch(`/api/export/${projectId}/history`);
      if (res && res.jobs) {
        setHistory(res.jobs.slice(0, 5));
      }
    } catch {}
  };

  const toggleChapter = (id: string) => {
    setSelectedChapters(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const saveJobToHistory = (format: string, size: number = 1024) => {
    const job = {
      id: 'job_' + Date.now(),
      format,
      status: 'done',
      createdAt: Date.now(),
      completedAt: Date.now() + 200,
      size
    };
    try {
      const existing = JSON.parse(localStorage.getItem('novelist_export_jobs') || '[]');
      existing.unshift(job);
      localStorage.setItem('novelist_export_jobs', JSON.stringify(existing));
      setHistory(existing.slice(0, 5));
    } catch {}
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    fireConfetti({ type: 'celebration', particleCount: 100 });
  };

  const downloadHtmlOffline = () => {
    const filteredChapters = chapters
      .filter((c: any) => selectedChapters.includes(c.id))
      .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const html = generatePrintableBookHtml(projectTitle, authorName, filteredChapters, {
      style: selectedStyle,
      includeFrontMatter,
      includeToc
    });

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${projectTitle}_ban_in_A4.html`);
    toast.success('Đã tải tệp HTML Sách offline thành công!');
  };

  const handleExport = async () => {
    if (selectedChapters.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 chương để xuất');
      return;
    }

    setLoading(true);
    setResult(null);

    const filteredChapters = chapters
      .filter((c: any) => selectedChapters.includes(c.id))
      .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));

    try {
      // 1. Specialized handling for PDF: Open formatted A4 Book print window
      if (selectedFormat === 'pdf') {
        const html = generatePrintableBookHtml(projectTitle, authorName, filteredChapters, {
          style: selectedStyle,
          includeFrontMatter,
          includeToc
        });

        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.open();
          printWin.document.write(html);
          printWin.document.close();
          setTimeout(() => {
            try {
              printWin.focus();
              printWin.print();
            } catch {}
          }, 400);
          toast.success('Đã mở bản in A4! Chọn "Lưu dưới dạng PDF" (Save as PDF) để lưu tệp.');
        } else {
          // If popup is blocked, download printable HTML directly
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          downloadBlob(blob, `${projectTitle}_ban_in_A4.html`);
          toast.info('Trình duyệt đã chặn cửa sổ in. Đã tự động tải file HTML; bạn chỉ cần mở file và nhấn Ctrl+P để lưu PDF!');
        }

        saveJobToHistory('pdf', Math.max(1024, filteredChapters.length * 2048));
        setResult({
          format: 'pdf',
          extension: 'pdf',
          size: filteredChapters.length * 2048
        });
        setLoading(false);
        return;
      }

      // 2. Try Server API Route for DOCX / HTML / MD / TXT
      let serverHandled = false;
      try {
        const res = await apiFetch('/api/export', {
          method: 'POST',
          body: JSON.stringify({
            format: selectedFormat,
            projectTitle,
            authorName,
            chapters: filteredChapters,
            options: {
              style: selectedStyle,
              includeFrontMatter,
              includeToc
            }
          })
        });

        if (res && res.success) {
          if (res.downloadBase64) {
            const binaryStr = atob(res.downloadBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: res.mimeType });
            downloadBlob(blob, `${projectTitle}.${res.extension}`);
            saveJobToHistory(res.format, res.size);
            setResult(res);
            toast.success(`Đã xuất tệp Word (.${res.extension}) thành công!`);
            serverHandled = true;
          } else if (res.textContent) {
            const blob = new Blob([res.textContent], { type: res.mimeType });
            downloadBlob(blob, `${projectTitle}.${res.extension}`);
            saveJobToHistory(res.format, res.size);
            setResult(res);
            toast.success(`Đã xuất tệp ${selectedFormat.toUpperCase()} thành công!`);
            serverHandled = true;
          }
        }
      } catch (err) {
        console.warn('API /api/export failed, switching to client generation:', err);
      }

      if (serverHandled) {
        setLoading(false);
        return;
      }

      // 3. Client-Side Fallback Generation
      let blob: Blob;
      let ext = selectedFormat;

      if (selectedFormat === 'docx') {
        const {
          Document,
          Packer,
          Paragraph,
          TextRun,
          HeadingLevel,
          AlignmentType,
          PageBreak,
          Footer,
          PageNumber
        } = await import('docx');

        const docChildren: any[] = [];

        // Title page
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

        // TOC
        if (includeToc && filteredChapters.length > 0) {
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

          filteredChapters.forEach((ch: any, idx: number) => {
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

        // Chapters
        filteredChapters.forEach((ch: any, idx: number) => {
          if (idx > 0 || includeFrontMatter || includeToc) {
            docChildren.push(new Paragraph({ children: [new PageBreak()] }));
          }

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
                  indent: { firstLine: 720 },
                  spacing: { after: 120, line: 360 },
                  children: [
                    new TextRun({
                      text: pText,
                      size: 24,
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

        blob = await Packer.toBlob(doc);
        ext = 'docx';
      } else if (selectedFormat === 'epub') {
        const jszipModule = await import('jszip');
        const JSZip = (jszipModule as any).default || jszipModule;
        const zip = new JSZip();

        zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
        zip.file(
          'META-INF/container.xml',
          `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
        );

        const escapeXml = (str: string) =>
          (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        zip.file(
          'OEBPS/style.css',
          `body { font-family: Georgia, 'Times New Roman', serif; margin: 5% 8%; line-height: 1.8; color: #111; }
h1.book-title { text-align: center; font-size: 2.2em; margin-top: 25%; margin-bottom: 0.5em; font-weight: bold; }
p.author { text-align: center; font-style: italic; font-size: 1.2em; margin-bottom: 40%; }
h2.chapter-title { text-align: center; font-size: 1.6em; margin-top: 2em; margin-bottom: 1.5em; border-bottom: 1px solid #ccc; padding-bottom: 0.5em; }
p { text-indent: 1.5em; margin: 0 0 0.8em 0; text-align: justify; }`
        );

        zip.file(
          'OEBPS/title.xhtml',
          `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <title>${escapeXml(projectTitle)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1 class="book-title">${escapeXml(projectTitle)}</h1>
  ${authorName ? `<p class="author">${escapeXml(authorName)}</p>` : ''}
</body>
</html>`
        );

        const chapterManifestItems: string[] = [];
        const chapterSpineItems: string[] = [];
        const navPoints: string[] = [];

        filteredChapters.forEach((ch: any, idx: number) => {
          const fileId = `chapter_${idx + 1}`;
          const fileName = `${fileId}.xhtml`;
          const paragraphs = parseChapterParagraphs(ch.content);
          const parasHtml =
            paragraphs.length > 0
              ? paragraphs.map(p => `<p>${escapeXml(p)}</p>`).join('\n')
              : '<p></p>';

          zip.file(
            `OEBPS/${fileName}`,
            `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <title>${escapeXml(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h2 class="chapter-title">${escapeXml(ch.title)}</h2>
  ${parasHtml}
</body>
</html>`
          );

          chapterManifestItems.push(`<item id="${fileId}" href="${fileName}" media-type="application/xhtml+xml"/>`);
          chapterSpineItems.push(`<itemref idref="${fileId}"/>`);
          navPoints.push(`
    <navPoint id="navPoint-${idx + 1}" playOrder="${idx + 2}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="${fileName}"/>
    </navPoint>`);
        });

        zip.file(
          'OEBPS/toc.ncx',
          `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${projectId}"/>
    <meta name="dtb:depth" content="1"/>
  </head>
  <docTitle><text>${escapeXml(projectTitle)}</text></docTitle>
  <navMap>
    <navPoint id="navPoint-title" playOrder="1">
      <navLabel><text>Bìa sách</text></navLabel>
      <content src="title.xhtml"/>
    </navPoint>
    ${navPoints.join('\n')}
  </navMap>
</ncx>`
        );

        zip.file(
          'OEBPS/content.opf',
          `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(projectTitle)}</dc:title>
    <dc:creator opf:role="aut">${escapeXml(authorName || 'Tác giả')}</dc:creator>
    <dc:language>vi</dc:language>
    <dc:identifier id="BookId">urn:uuid:${projectId}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="titlepage" href="title.xhtml" media-type="application/xhtml+xml"/>
    ${chapterManifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    <itemref idref="titlepage"/>
    ${chapterSpineItems.join('\n    ')}
  </spine>
</package>`
        );

        blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
        ext = 'epub';
      } else if (selectedFormat === 'html') {
        const html = generatePrintableBookHtml(projectTitle, authorName, filteredChapters, {
          style: selectedStyle,
          includeFrontMatter,
          includeToc
        });
        blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      } else if (selectedFormat === 'md') {
        let md = `# ${projectTitle}\n\n`;
        if (authorName) md += `*Tác giả: ${authorName}*\n\n`;
        filteredChapters.forEach((ch: any, idx: number) => {
          md += `## Chương ${idx + 1}: ${ch.title}\n\n`;
          const paras = parseChapterParagraphs(ch.content);
          md += paras.join('\n\n') + '\n\n---\n\n';
        });
        blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      } else if (selectedFormat === 'json') {
        const exportData = {
          title: projectTitle,
          author: authorName || 'Tác giả',
          exportedAt: new Date().toISOString(),
          chapters: filteredChapters.map((ch: any) => ({
            id: ch.id,
            title: ch.title,
            paragraphs: parseChapterParagraphs(ch.content),
            wordCount: ch.wordCount
          }))
        };
        blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      } else {
        // Plain text
        let text = `${projectTitle}\n${authorName ? `Tác giả: ${authorName}\n` : ''}\n====================\n\n`;
        filteredChapters.forEach((ch: any, idx: number) => {
          text += `\n\n--- Chương ${idx + 1}: ${ch.title} ---\n\n`;
          const paras = parseChapterParagraphs(ch.content);
          text += paras.join('\n\n') + '\n';
        });
        blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      }

      downloadBlob(blob, `${projectTitle}.${ext}`);
      saveJobToHistory(ext, blob.size);
      setResult({ format: ext, extension: ext, size: blob.size });
      toast.success(`Xuất ${ext.toUpperCase()} thành công!`);
    } catch (e: any) {
      console.error('Lỗi xuất bản:', e);
      toast.error('Lỗi khi xuất tệp: ' + (e.message || 'Không xác định'));
    } finally {
      setLoading(false);
    }
  };

  const selectedFormatInfo = formats.find(f => f.id === selectedFormat);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Download className="w-5 h-5 text-primary" /> Xuất bản tác phẩm - {projectTitle}
          </DialogTitle>
          <DialogDescription>
            Tạo sách in A4 (PDF), tệp Word biên tập (DOCX), sách điện tử (EPUB) chuẩn tiếng Việt
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-6 mt-4">
          {/* Left: Format & Style */}
          <div className="md:col-span-2 space-y-6">
            {/* Format selection */}
            <div>
              <h4 className="font-semibold text-sm mb-3">1. Chọn định dạng xuất</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {formats.map(fmt => {
                  const Icon = fmt.icon;
                  const isSelected = selectedFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => setSelectedFormat(fmt.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                          : 'border-input hover:border-primary/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${fmt.color} flex items-center justify-center text-white shrink-0 mt-0.5`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm flex items-center justify-between">
                          {fmt.name}
                          {isSelected && <Badge variant="default" className="text-[10px] h-4 px-1.5">Chọn</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{fmt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Style selection for PDF / DOCX */}
            <div>
              <h4 className="font-semibold text-sm mb-3">2. Bố cục & Phong cách sách</h4>
              <div className="grid grid-cols-3 gap-3">
                {styles.map(st => {
                  const isSelected = selectedStyle === st.id;
                  return (
                    <button
                      key={st.id}
                      onClick={() => setSelectedStyle(st.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                          : 'border-input hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-sm">{st.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{st.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Options */}
            <div>
              <h4 className="font-semibold text-sm mb-3">3. Tùy chọn trang</h4>
              <div className="space-y-3 bg-muted/30 p-3.5 rounded-xl border">
                <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeFrontMatter}
                    onChange={e => setIncludeFrontMatter(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span>Bao gồm trang bìa (Tên tác phẩm, tác giả, dấu mốc xuất bản)</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeToc}
                    onChange={e => setIncludeToc(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                  />
                  <span>Bao gồm mục lục tiểu thuyết</span>
                </label>
                <div className="pt-1">
                  <label className="text-xs font-medium text-muted-foreground">Tên tác giả / Bút danh (in trên trang bìa):</label>
                  <Input
                    value={authorName}
                    onChange={e => setAuthorName(e.target.value)}
                    placeholder="Nhập tên bút danh..."
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Chapters selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">4. Chọn chương xuất bản ({selectedChapters.length}/{chapters.length})</h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedChapters(chapters.map((c: any) => c.id))}>
                    Chọn tất cả
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedChapters([])}>
                    Bỏ chọn
                  </Button>
                </div>
              </div>
              <div className="border rounded-xl max-h-48 overflow-auto divide-y bg-card">
                {chapters.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">Chưa có chương nào trong dự án</div>
                ) : (
                  chapters
                    .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
                    .map((ch: any, idx: number) => (
                      <label key={ch.id} className="flex items-center gap-2.5 p-2.5 hover:bg-accent/50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedChapters.includes(ch.id)}
                          onChange={() => toggleChapter(ch.id)}
                          className="rounded text-primary focus:ring-primary w-4 h-4"
                        />
                        <span className="font-medium text-xs text-muted-foreground w-6">{idx + 1}.</span>
                        <span className="flex-1 truncate">{ch.title || 'Chương không tên'}</span>
                        <Badge variant="secondary" className="text-[10px]">{ch.wordCount || 0} từ</Badge>
                      </label>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Preview & Action */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Xem trước cấu hình</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`w-full aspect-[3/4] rounded-xl border-2 flex flex-col items-center justify-center p-4 text-center ${
                  styles.find(s => s.id === selectedStyle)?.preview || 'bg-white'
                }`}>
                  <div className={`w-10 h-10 rounded-xl ${selectedFormatInfo?.color} flex items-center justify-center text-white mb-3 shadow-md`}>
                    {selectedFormatInfo && <selectedFormatInfo.icon className="w-5 h-5" />}
                  </div>
                  <div className="font-bold text-sm truncate w-full px-2">{projectTitle}</div>
                  <div className="text-xs text-muted-foreground mt-1">{authorName || 'Tác giả'}</div>
                  <div className="mt-4 text-[10px] text-muted-foreground leading-relaxed">
                    {selectedChapters.length} chương được chọn<br />
                    Định dạng: <strong>{selectedFormatInfo?.name}</strong><br />
                    Phong cách: <strong>{selectedStyle}</strong>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center mt-3">
                    {includeFrontMatter && <Badge variant="secondary" className="text-[10px]">Có bìa</Badge>}
                    {includeToc && <Badge variant="secondary" className="text-[10px]">Có mục lục</Badge>}
                  </div>
                </div>

                {/* Primary Export Button */}
                {selectedFormat === 'pdf' ? (
                  <div className="space-y-2 mt-4">
                    <Button
                      onClick={handleExport}
                      disabled={loading || selectedChapters.length === 0}
                      className="w-full bg-red-600 hover:bg-red-700 text-white shadow-sm"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang chuẩn bị...</>
                      ) : (
                        <><Printer className="w-4 h-4 mr-2" /> 🖨️ Mở bản in & Lưu PDF (A4)</>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={downloadHtmlOffline}
                      disabled={loading || selectedChapters.length === 0}
                      className="w-full text-xs"
                    >
                      <Code className="w-3.5 h-3.5 mr-1" /> Tải file HTML Sách Offline
                    </Button>
                  </div>
                ) : selectedFormat === 'docx' ? (
                  <Button
                    onClick={handleExport}
                    disabled={loading || selectedChapters.length === 0}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang tạo tệp Word...</>
                    ) : (
                      <><File className="w-4 h-4 mr-2" /> 📄 Xuất tệp Word (.docx)</>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleExport}
                    disabled={loading || selectedChapters.length === 0}
                    className="w-full mt-4 shadow-sm"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang xử lý...</>
                    ) : (
                      <><Download className="w-4 h-4 mr-2" /> Xuất {selectedFormat.toUpperCase()}</>
                    )}
                  </Button>
                )}

                {result && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 text-xs">
                    <div className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Xuất bản thành công!
                    </div>
                    <div className="text-green-700 dark:text-green-400 mt-1">
                      Định dạng: .{result.extension} • Dung lượng: {(result.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {history.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold">Lịch sử xuất gần đây</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {history.map((job: any) => (
                    <div key={job.id} className="flex items-center justify-between text-xs p-2 bg-muted/40 rounded-lg border border-border/50">
                      <div>
                        <div className="font-medium text-foreground">{job.format?.toUpperCase()}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(job.createdAt).toLocaleString('vi-VN')}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-green-600 dark:text-green-400">Hoàn thành</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="text-xs text-muted-foreground bg-muted/40 p-3.5 rounded-xl border border-border/50 space-y-1.5">
              <div className="font-semibold text-foreground text-xs">💡 Lưu ý quan trọng:</div>
              <ul className="list-disc list-inside space-y-1 leading-relaxed text-[11px]">
                <li><strong>PDF A4:</strong> Mở cửa sổ in ấn, trong mục máy in chọn <strong>"Save as PDF" / "Lưu dưới dạng PDF"</strong> để xuất tệp vector sắc nét 100% tiếng Việt.</li>
                <li><strong>DOCX Word:</strong> Chuẩn OpenXML đầy đủ lề, giãn dòng 1.5, ngắt trang và số trang cho nhà xuất bản.</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
