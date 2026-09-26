'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Download, FileText, BookOpen, File } from 'lucide-react';
import { ExportDialog } from '@/components/export/export-dialog';

export default function ExportPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [dialogFormat, setDialogFormat] = useState('pdf');

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const openExportModal = (format: string = 'pdf') => {
    setDialogFormat(format);
    setShowExportDialog(true);
  };

  const fetchData = async () => {
    try {
      const [projRes, chapRes] = await Promise.all([
        apiFetch(`/api/projects/${projectId}`),
        apiFetch(`/api/projects/${projectId}/chapters`)
      ]);
      setProject(projRes.project);
      setChapters(chapRes.chapters);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground animate-pulse">Đang tải...</div>;
  if (!project) return <div className="p-8 text-sm">Không tìm thấy dự án</div>;

  const totalWords = chapters.reduce((sum: number, ch: any) => sum + (ch.wordCount || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-4 p-4 max-w-6xl mx-auto">
          <Link href={`/editor/${projectId}`}>
            <Button variant="ghost" size="icon" title="Quay lại tác phẩm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-base sm:text-lg">Xuất bản - {project.title}</h1>
            <p className="text-xs text-muted-foreground">{chapters.length} chương • {totalWords.toLocaleString()} từ</p>
          </div>
          <div className="ml-auto">
            <Button onClick={() => setShowExportDialog(true)}>
              <Download className="w-4 h-4 mr-2" /> Xuất bản mới
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        {/* Quick export cards */}
        <div>
          <h2 className="font-semibold text-base mb-3">Tùy chọn xuất bản</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-red-500/50" onClick={() => openExportModal('pdf')}>
              <CardHeader className="pb-3">
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-white mb-2 shadow-md shadow-red-500/25">
                  <FileText className="w-6 h-6" />
                </div>
                <CardTitle className="text-base">PDF - Sách in A4</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Layout sách A4 tiêu chuẩn, mục lục, đánh số trang, font tiếng Việt sắc nét. Mở bản in & Lưu PDF trực tiếp.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">A4 Chuẩn</Badge>
                  <Badge variant="secondary" className="text-xs">Lưu PDF</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-500/50" onClick={() => openExportModal('docx')}>
              <CardHeader className="pb-3">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white mb-2 shadow-md shadow-blue-500/25">
                  <File className="w-6 h-6" />
                </div>
                <CardTitle className="text-base">DOCX - Word</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Gửi nhà xuất bản, chỉnh sửa trong Word, Google Docs. Giữ tiêu đề chương, giãn dòng 1.5, ngắt trang.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">Word .docx</Badge>
                  <Badge variant="secondary" className="text-xs">Chuẩn NXB</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-emerald-500/50" onClick={() => openExportModal('epub')}>
              <CardHeader className="pb-3">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white mb-2 shadow-md shadow-emerald-500/25">
                  <BookOpen className="w-6 h-6" />
                </div>
                <CardTitle className="text-base">EPUB - Ebook</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Đọc trên Kindle, điện thoại, Apple Books. Có mục lục, phân trang và thông tin tác giả.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">Kindle</Badge>
                  <Badge variant="secondary" className="text-xs">Ebook</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">💡 Hướng dẫn xuất bản</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p><strong>PDF:</strong> Mở cửa sổ in ấn A4 sắc nét, hỗ trợ căn chỉnh lề, mục lục, số trang và chuẩn tiếng Việt.</p>
            <p><strong>DOCX:</strong> Xuất định dạng Word chuẩn OpenXML với lề thụt dòng đầu, giãn cách 1.5, ngắt trang từng chương để nộp bản thảo cho biên tập viên và nhà xuất bản.</p>
            <p><strong>EPUB:</strong> Đóng gói file ebook tiêu chuẩn, đọc mượt mà trên Kindle, Google Play Books, Apple Books.</p>
          </CardContent>
        </Card>
      </div>

      <ExportDialog
        projectId={projectId}
        projectTitle={project.title}
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        chapters={chapters}
        initialFormat={dialogFormat}
      />
    </div>
  );
}
