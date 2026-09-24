'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { Download, FileText, BookOpen, File, Code, FileJson, Check, Loader2, Eye } from 'lucide-react';

interface ExportDialogProps {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters?: any[];
}

const formats = [
  { id: 'pdf', name: 'PDF', desc: 'Sách in, layout đẹp, đánh số trang', icon: FileText, color: 'bg-red-500', ext: 'pdf' },
  { id: 'docx', name: 'DOCX', desc: 'Word, gửi NXB, chỉnh sửa', icon: File, color: 'bg-blue-500', ext: 'docx' },
  { id: 'epub', name: 'EPUB', desc: 'Ebook, đọc trên Kindle, điện thoại', icon: BookOpen, color: 'bg-green-500', ext: 'epub' },
  { id: 'html', name: 'HTML', desc: 'Website tĩnh, deploy Cloudflare Pages', icon: Code, color: 'bg-orange-500', ext: 'html' },
  { id: 'md', name: 'Markdown', desc: 'Backup, Obsidian, Notion', icon: FileText, color: 'bg-gray-700', ext: 'md' },
  { id: 'txt', name: 'Plain Text', desc: 'Text thuần, nhẹ nhất', icon: FileText, color: 'bg-gray-500', ext: 'txt' },
  { id: 'json', name: 'JSON', desc: 'Backup đầy đủ để import lại', icon: FileJson, color: 'bg-purple-500', ext: 'json' }
];

const styles = [
  { id: 'modern', name: 'Modern', desc: 'Hiện đại, màu xanh, sans-serif', preview: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' },
  { id: 'classic', name: 'Classic', desc: 'Cổ điển, Times New Roman, nghiêm túc', preview: 'bg-amber-50 border-amber-200' },
  { id: 'minimal', name: 'Minimal', desc: 'Tối giản, trắng, nhiều khoảng trắng', preview: 'bg-white border-gray-200' }
];

export function ExportDialog({ projectId, projectTitle, open, onOpenChange, chapters = [] }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [includeFrontMatter, setIncludeFrontMatter] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      // Select all chapters by default
      setSelectedChapters(chapters.map((c: any) => c.id));
      fetchHistory();
      // Get user name from localStorage or API
      const userStr = localStorage.getItem('auth-storage');
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          setAuthorName(parsed.state?.user?.name || '');
        } catch {}
      }
    }
  }, [open, chapters]);

  const fetchHistory = async () => {
    try {
      const res = await apiFetch(`/api/export/${projectId}/history`);
      setHistory(res.jobs.slice(0, 5));
    } catch {}
  };

  const toggleChapter = (id: string) => {
    setSelectedChapters(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleExport = async () => {
    if (selectedChapters.length === 0) {
      toast.error('Chọn ít nhất 1 chương');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await apiFetch(`/api/export/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({
          format: selectedFormat,
          style: selectedStyle,
          includeFrontMatter,
          includeToc,
          authorName,
          chapterIds: selectedChapters,
          fontSize: 12,
          lineSpacing: 1.5,
          language: 'vi'
        })
      });

      setResult(res);
      toast.success(`Xuất ${selectedFormat.toUpperCase()} thành công!`);
      fetchHistory();

      // Auto download if base64 available (R2 not configured)
      if (res.downloadBase64) {
        const binaryStr = atob(res.downloadBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: res.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectTitle}.${res.extension}`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (res.downloadUrl && process.env.NEXT_PUBLIC_API_URL) {
        // Download via remote API
        const token = localStorage.getItem('token');
        const downloadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${res.downloadUrl}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (downloadRes.ok) {
          const blob = await downloadRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectTitle}.${res.extension}`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        // Direct client-side generation
        const filteredChapters = chapters
          .filter((c: any) => selectedChapters.includes(c.id))
          .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));

        let blob: Blob;
        let ext = selectedFormat;

        if (selectedFormat === 'docx') {
          try {
            const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
            const doc = new Document({
              sections: [{
                properties: {},
                children: [
                  new Paragraph({
                    text: projectTitle,
                    heading: HeadingLevel.TITLE,
                    spacing: { after: 300 }
                  }),
                  ...(authorName ? [
                    new Paragraph({
                      children: [new TextRun({ text: `Tác giả: ${authorName}`, italics: true })],
                      spacing: { after: 600 }
                    })
                  ] : []),
                  ...filteredChapters.flatMap(ch => {
                    let cleanText = ch.content || '';
                    try {
                      const parsed = JSON.parse(cleanText);
                      const extract = (n: any): string => {
                        let t = '';
                        if (n.text) t += n.text + ' ';
                        if (n.content) t += n.content.map(extract).join('');
                        return t;
                      };
                      cleanText = extract(parsed);
                    } catch {
                      cleanText = cleanText.replace(/<[^>]+>/g, ' ');
                    }

                    const paragraphs = cleanText.split('\n').map((p: string) => p.trim()).filter(Boolean);
                    return [
                      new Paragraph({
                        text: ch.title,
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 }
                      }),
                      ...(paragraphs.length > 0
                        ? paragraphs.map((p: string) => new Paragraph({ text: p, spacing: { after: 160, line: 360 } }))
                        : [new Paragraph({ text: '', spacing: { after: 200 } })])
                    ];
                  })
                ]
              }]
            });
            blob = await Packer.toBlob(doc);
            ext = 'docx';
          } catch {
            let text = `${projectTitle}\n${authorName ? `Tác giả: ${authorName}\n` : ''}\n====================\n\n`;
            for (const ch of filteredChapters) {
              text += `\n\n--- ${ch.title} ---\n\n${ch.content || ''}\n`;
            }
            blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            ext = 'txt';
          }
        } else if (selectedFormat === 'json') {
          const exportData = {
            title: projectTitle,
            author: authorName || 'Tác giả',
            exportedAt: new Date().toISOString(),
            chapters: filteredChapters
          };
          blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        } else if (selectedFormat === 'md') {
          let md = `# ${projectTitle}\n\n`;
          if (authorName) md += `*Tác giả: ${authorName}*\n\n`;
          for (const ch of filteredChapters) {
            md += `## ${ch.title}\n\n${ch.content || ''}\n\n---\n\n`;
          }
          blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        } else if (selectedFormat === 'html') {
          let html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${projectTitle}</title><style>body{font-family:serif;max-width:800px;margin:40px auto;line-height:1.8;padding:0 20px;}h1,h2{text-align:center;}</style></head><body><h1>${projectTitle}</h1>${authorName ? `<p style="text-align:center"><em>${authorName}</em></p>` : ''}<hr/>`;
          for (const ch of filteredChapters) {
            html += `<h2>${ch.title}</h2><div>${(ch.content || '').replace(/\n/g, '<br/>')}</div><hr/>`;
          }
          html += '</body></html>';
          blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        } else {
          // Plain text / default
          let text = `${projectTitle}\n${authorName ? `Tác giả: ${authorName}\n` : ''}\n====================\n\n`;
          for (const ch of filteredChapters) {
            text += `\n\n--- ${ch.title} ---\n\n${ch.content || ''}\n`;
          }
          blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectTitle}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      }

    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedFormatInfo = formats.find(f => f.id === selectedFormat);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" /> Xuất bản - {projectTitle}
          </DialogTitle>
          <DialogDescription>
            Chọn định dạng, chapters và style để xuất bản tiểu thuyết
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-6 mt-4">
          {/* Left: Format & Style */}
          <div className="md:col-span-2 space-y-6">
            {/* Format selection */}
            <div>
              <h4 className="font-medium mb-3">1. Chọn định dạng</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {formats.map(fmt => {
                  const Icon = fmt.icon;
                  const isSelected = selectedFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => setSelectedFormat(fmt.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                        isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-input hover:border-primary/30'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-10 h-10 rounded-lg ${fmt.color} flex items-center justify-center text-white flex-shrink-0`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{fmt.name}</span>
                            <Badge variant="secondary" className="text-[10px]">.{fmt.ext}</Badge>
                            {isSelected && <Check className="w-3 h-3 text-primary" />}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{fmt.desc}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Style (for PDF/DOCX/HTML) */}
            {(selectedFormat === 'pdf' || selectedFormat === 'docx' || selectedFormat === 'html') && (
              <div>
                <h4 className="font-medium mb-3">2. Chọn style</h4>
                <div className="grid grid-cols-3 gap-2">
                  {styles.map(st => (
                    <button
                      key={st.id}
                      onClick={() => setSelectedStyle(st.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedStyle === st.id ? 'border-primary bg-primary/5' : 'border-input'
                      }`}
                    >
                      <div className={`w-full h-16 rounded-lg border-2 mb-2 ${st.preview} flex items-center justify-center`}>
                        <div className="text-xs font-serif">Aa</div>
                      </div>
                      <div className="font-medium text-xs">{st.name}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{st.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Options */}
            <div>
              <h4 className="font-medium mb-3">3. Tùy chọn</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={includeFrontMatter} onChange={e => setIncludeFrontMatter(e.target.checked)} className="rounded" />
                  Bao gồm trang bìa, tên tác giả, mô tả
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={includeToc} onChange={e => setIncludeToc(e.target.checked)} className="rounded" />
                  Bao gồm mục lục
                </label>
                <div>
                  <label className="text-xs font-medium">Tên tác giả (cho trang bìa)</label>
                  <Input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Tên bút danh..." className="mt-1 h-8 text-sm" />
                </div>
              </div>
            </div>

            {/* Chapters */}
            <div>
              <h4 className="font-medium mb-3">4. Chọn chương ({selectedChapters.length}/{chapters.length})</h4>
              <div className="flex gap-2 mb-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedChapters(chapters.map((c: any) => c.id))}>Chọn tất cả</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedChapters([])}>Bỏ chọn</Button>
              </div>
              <div className="border rounded-lg max-h-40 overflow-auto divide-y">
                {chapters
                  .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
                  .map((ch: any) => (
                    <label key={ch.id} className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer text-sm">
                      <input type="checkbox" checked={selectedChapters.includes(ch.id)} onChange={() => toggleChapter(ch.id)} />
                      <span className="flex-1 truncate">{ch.title}</span>
                      <Badge variant="secondary" className="text-[10px]">{ch.wordCount} từ</Badge>
                    </label>
                  ))}
              </div>
            </div>
          </div>

          {/* Right: Preview & Action */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Xem trước</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`w-full aspect-[3/4] rounded-lg border-2 flex flex-col items-center justify-center p-4 text-center ${
                  styles.find(s => s.id === selectedStyle)?.preview || 'bg-white'
                }`}>
                  <div className={`w-8 h-8 rounded ${selectedFormatInfo?.color} flex items-center justify-center text-white mb-2`}>
                    {selectedFormatInfo && <selectedFormatInfo.icon className="w-4 h-4" />}
                  </div>
                  <div className="font-bold text-sm truncate w-full">{projectTitle}</div>
                  <div className="text-xs text-muted-foreground mt-1">{authorName || 'Tác giả'}</div>
                  <div className="mt-4 text-[10px] text-muted-foreground">
                    {selectedChapters.length} chương<br />
                    {selectedFormatInfo?.name} • {selectedStyle}
                  </div>
                  {includeFrontMatter && <Badge variant="secondary" className="mt-2 text-[10px]">Có bìa</Badge>}
                  {includeToc && <Badge variant="secondary" className="mt-1 text-[10px]">Có mục lục</Badge>}
                </div>

                <Button onClick={handleExport} disabled={loading || selectedChapters.length === 0} className="w-full mt-4">
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang xuất...</> : <><Download className="w-4 h-4 mr-2" /> Xuất {selectedFormat.toUpperCase()}</>}
                </Button>

                {result && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 text-xs">
                    <div className="font-medium text-green-800 dark:text-green-300 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Thành công!
                    </div>
                    <div className="text-green-700 dark:text-green-400 mt-1">
                      Size: {(result.size / 1024).toFixed(1)} KB<br />
                      Format: {result.format} • .{result.extension}
                    </div>
                    {result.downloadUrl && (
                      <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs" onClick={() => {
                        const token = localStorage.getItem('token');
                        window.open(`${process.env.NEXT_PUBLIC_API_URL || ''}${result.downloadUrl}?token=${token}`, '_blank');
                      }}>
                        <Download className="w-3 h-3 mr-1" /> Tải lại
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {history.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs">Lịch sử xuất (5 gần nhất)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {history.map((job: any) => (
                    <div key={job.id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                      <div>
                        <div className="font-medium">{job.format.toUpperCase()} • {new Date(job.createdAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-muted-foreground">{job.status}</div>
                      </div>
                      <Badge variant={job.status === 'done' ? 'default' : 'secondary'} className="text-[10px]">{job.status}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="text-[11px] text-muted-foreground bg-muted p-3 rounded-lg">
              <div className="font-medium mb-1">💡 Mẹo:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>PDF: layout sách, gửi in</li>
                <li>DOCX: gửi NXB, Word</li>
                <li>EPUB: đọc trên điện thoại, Kindle</li>
                <li>HTML: deploy lên Pages làm website truyện</li>
                <li>File lưu trên R2, tải lại trong lịch sử</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
