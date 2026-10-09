'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/utils';
import { Download, FileText, BookOpen, File, ArrowUpRight } from 'lucide-react';
import { ExportDialog } from '@/components/export/export-dialog';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PageHeader, StudioState } from '@/components/studio/page-header';
const formats = [
  {
    id: 'pdf',
    label: 'PDF',
    title: 'Một bản thảo để đọc',
    description:
      'Bố cục A4, mục lục và số trang. Mở bản in rồi lưu PDF từ trình duyệt.',
    note: 'Đọc lại & in ấn',
    icon: FileText,
  },
  {
    id: 'docx',
    label: 'DOCX',
    title: 'Sẵn sàng để biên tập',
    description:
      'Tiếp tục chỉnh sửa trong Word hoặc Google Docs, giữ tiêu đề chương và ngắt trang.',
    note: 'Word & Google Docs',
    icon: File,
  },
  {
    id: 'epub',
    label: 'EPUB',
    title: 'Câu chuyện đi cùng bạn',
    description:
      'Mang sách lên thiết bị đọc và ứng dụng ebook, với mục lục và thông tin tác giả.',
    note: 'Thiết bị đọc sách',
    icon: BookOpen,
  },
];
export default function ExportPage() {
  const projectId = useParams().projectId as string;
  const [project, setProject] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState('pdf');
  const fetchData = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        apiFetch('/api/projects/' + projectId),
        apiFetch('/api/projects/' + projectId + '/chapters'),
      ]);
      setProject(p.project);
      setChapters(c.chapters || []);
    } catch (e: any) {
      setError(e.message || 'Không thể tải bản thảo');
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);
  return (
    <DashboardLayout projectId={projectId} mode="project">
      <div className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10">
        <PageHeader
          eyebrow="Từ bản thảo đến cuốn sách"
          title="Mang câu chuyện ra thế giới"
          description={
            project
              ? project.title
              : 'Chọn định dạng phù hợp cho bước tiếp theo của tác phẩm.'
          }
        />
        {loading ? (
          <StudioState
            busy
            title="Đang chuẩn bị bản thảo"
            description="Tải các chương để xuất bản…"
          />
        ) : error ? (
          <StudioState
            title="Chưa thể mở bản thảo"
            description={error}
            action={<Button onClick={fetchData}>Thử lại</Button>}
          />
        ) : !project ? (
          <StudioState title="Không tìm thấy tác phẩm" />
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-5 rounded-xl border bg-card px-6 py-5">
              <div>
                <p className="studio-eyebrow mb-2">Bản thảo hiện tại</p>
                <p className="text-sm text-muted-foreground">
                  {chapters.length} chương ·{' '}
                  {chapters
                    .reduce((sum, c) => sum + (c.wordCount || 0), 0)
                    .toLocaleString()}{' '}
                  từ
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setFormat('pdf');
                  setOpen(true);
                }}
                disabled={!chapters.length}
              >
                <Download />
                Tùy chỉnh xuất bản
              </Button>
            </div>
            <div className="grid gap-5 xl:grid-cols-3">
              {formats.map(
                ({ id, label, title, description, note, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={!chapters.length}
                    onClick={() => {
                      setFormat(id);
                      setOpen(true);
                    }}
                    className="studio-surface glow-card flex flex-col p-7 text-left disabled:opacity-60"
                  >
                    <div className="mb-10 flex items-center justify-between">
                      <Icon
                        className="h-8 w-8 text-primary"
                        strokeWidth={1.3}
                      />
                      <span className="rounded-md border px-2 py-1 font-mono text-[10px] text-muted-foreground">
                        {label}
                      </span>
                    </div>
                    <h2 className="mb-3 font-serif text-2xl">{title}</h2>
                    <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                    <div className="mt-8 flex items-center justify-between border-t pt-4 text-xs text-primary">
                      <span>{note}</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </button>
                )
              )}
            </div>
            {!chapters.length && (
              <p className="mt-6 text-sm text-muted-foreground">
                Thêm chương đầu tiên vào tác phẩm để bắt đầu xuất bản.
              </p>
            )}
            <div className="mt-10 rounded-xl border border-dashed p-6">
              <p className="text-sm font-medium">Cần một định dạng khác?</p>
              <p className="mt-2 text-sm text-muted-foreground">
                HTML, Markdown, văn bản thuần và JSON đều có trong tùy chỉnh
                xuất bản.
              </p>
            </div>
            <ExportDialog
              projectId={projectId}
              projectTitle={project.title}
              chapters={chapters}
              open={open}
              onOpenChange={setOpen}
              initialFormat={format}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
