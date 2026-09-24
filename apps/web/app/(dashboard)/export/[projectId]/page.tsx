'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, Download, FileText, BookOpen, File, Code, FileJson, Trash2, Eye, Calendar } from 'lucide-react';
import { ExportDialog } from '@/components/export/export-dialog';

export default function ExportPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [projRes, chapRes, historyRes] = await Promise.all([
        apiFetch(`/api/projects/${projectId}`),
        apiFetch(`/api/projects/${projectId}/chapters`),
        apiFetch(`/api/export/${projectId}/history`).catch(() => ({ jobs: [] }))
      ]);
      setProject(projRes.project);
      setChapters(chapRes.chapters);
      setJobs(historyRes.jobs || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadJob = async (job: any) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'}/api/export/download/${job.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.title || 'export'}.${job.format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đang tải...');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Xóa file export này?')) return;
    try {
      await apiFetch(`/api/export/jobs/${jobId}`, { method: 'DELETE' });
      toast.success('Đã xóa');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const formatIcons: Record<string, any> = {
    pdf: FileText,
    docx: File,
    epub: BookOpen,
    html: Code,
    md: FileText,
    txt: FileText,
    json: FileJson
  };

  const formatColors: Record<string, string> = {
    pdf: 'bg-red-500',
    docx: 'bg-blue-500',
    epub: 'bg-green-500',
    html: 'bg-orange-500',
    md: 'bg-gray-700',
    txt: 'bg-gray-500',
    json: 'bg-purple-500'
  };

  if (loading) return <div className="p-8">Đang tải...</div>;
  if (!project) return <div className="p-8">Không tìm thấy dự án</div>;

  const totalWords = chapters.reduce((sum: number, ch: any) => sum + (ch.wordCount || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-4 p-4 max-w-6xl mx-auto">
          <Link href={`/editor/${projectId}`}><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div>
            <h1 className="font-bold">Xuất bản - {project.title}</h1>
            <p className="text-xs text-muted-foreground">{chapters.length} chương • {totalWords.toLocaleString()} từ</p>
          </div>
          <div className="ml-auto">
            <Button onClick={() => setShowExportDialog(true)}><Download className="w-4 h-4 mr-2" /> Xuất bản mới</Button>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-8">
        {/* Quick export cards */}
        <div>
          <h2 className="font-semibold mb-4">Xuất nhanh</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-red-200" onClick={() => setShowExportDialog(true)}>
              <CardHeader className="pb-3">
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-white mb-2"><FileText className="w-6 h-6" /></div>
                <CardTitle className="text-base">PDF - Sách in</CardTitle>
                <CardDescription className="text-xs">Layout sách, mục lục, đánh số trang, font serif đẹp. Gửi in hoặc đọc.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">A4</Badge>
                  <Badge variant="secondary" className="text-xs">Modern/Classic/Minimal</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-200" onClick={() => setShowExportDialog(true)}>
              <CardHeader className="pb-3">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white mb-2"><File className="w-6 h-6" /></div>
                <CardTitle className="text-base">DOCX - Word</CardTitle>
                <CardDescription className="text-xs">Gửi nhà xuất bản, chỉnh sửa trong Word, Google Docs. Giữ heading, style.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">Word</Badge>
                  <Badge variant="secondary" className="text-xs">NXB</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-200" onClick={() => setShowExportDialog(true)}>
              <CardHeader className="pb-3">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white mb-2"><BookOpen className="w-6 h-6" /></div>
                <CardTitle className="text-base">EPUB - Ebook</CardTitle>
                <CardDescription className="text-xs">Đọc trên Kindle, điện thoại, Apple Books. Có mục lục, metadata.</CardDescription>
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

        {/* History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Lịch sử xuất bản</h2>
            <Badge variant="secondary">{jobs.length} files</Badge>
          </div>

          {jobs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Download className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <h3 className="font-medium mb-1">Chưa có file xuất nào</h3>
                <p className="text-sm text-muted-foreground mb-4">Xuất bản lần đầu để tạo file PDF/DOCX/EPUB</p>
                <Button onClick={() => setShowExportDialog(true)}>Xuất bản ngay</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {jobs.map((job: any) => {
                const Icon = formatIcons[job.format] || FileText;
                const color = formatColors[job.format] || 'bg-gray-500';
                return (
                  <Card key={job.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{project.title}.{job.format}</span>
                          <Badge variant={job.status === 'done' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">{job.status}</Badge>
                          <Badge variant="outline" className="text-[10px]">{job.format.toUpperCase()}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(job.createdAt).toLocaleString('vi-VN')}</span>
                          {job.completedAt && <span>• {Math.round((job.completedAt - job.createdAt)/1000)}s</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {job.status === 'done' && (
                          <>
                            <Button variant="outline" size="sm" className="h-8" onClick={() => downloadJob(job)}><Download className="w-3 h-3 mr-1" /> Tải</Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteJob(job.id)}><Trash2 className="w-3 h-3" /></Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Info */}
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">💡 Về xuất bản</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p><strong>PDF:</strong> Dùng pdf-lib, chạy trên Workers, hỗ trợ 3 styles (modern/classic/minimal), front matter, TOC, page numbers, A4.</p>
            <p><strong>DOCX:</strong> Dùng docx library, heading styles, justified text, first line indent, page breaks, gửi NXB.</p>
            <p><strong>EPUB:</strong> Dùng jszip, tạo EPUB 2.0 hợp lệ với container.xml, content.opf, toc.ncx, style.css, XHTML chapters, đọc được trên mọi ereader.</p>
            <p><strong>Lưu trữ:</strong> File lưu trên R2 bucket {'`exports/{userId}/{projectId}/{jobId}.{ext}`'} với metadata, tải lại bất kỳ lúc nào.</p>
            <p><strong>Giới hạn:</strong> Workers CPU 50ms free, nhưng pdf-lib/docx/jszip pure JS nên &lt; 10s cho tiểu thuyết 50k từ. File lớn hơn sẽ cần Paid Workers ($5/tháng).</p>
          </CardContent>
        </Card>
      </div>

      <ExportDialog
        projectId={projectId}
        projectTitle={project.title}
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        chapters={chapters}
      />
    </div>
  );
}
