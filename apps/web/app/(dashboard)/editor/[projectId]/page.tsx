'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/utils';
import { getProjectChapterStats } from '@/lib/sync-core';
import { getCachedChapters } from '@/lib/workspace-cache';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  FileText,
  GripVertical,
  Trash2,
  Edit3,
  Sparkles,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  X,
  Upload,
  Image as ImageIcon,
  BookOpen,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PageHeader, StudioState } from '@/components/studio/page-header';
import { useProjectStore } from '@/lib/store';
import { BookCoverArt } from '@/components/vfx/book-cover';
import { fireConfetti } from '@/components/vfx/confetti';
import { SparkleIcon } from '@/components/vfx/magic-sparkles';
import { playSuccessSound, playDeleteSound, playPopSound } from '@/lib/sound';
import { SoundToggleButton } from '@/components/layout/sound-provider';
import { SyncStatusButton } from '@/components/layout/sync-provider';
import { pushSync, pullSync } from '@/lib/sync';
import { deleteChapterWithSync } from '@/lib/delete-service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  buildTabTree,
  flattenTabTree,
  TabTreeNode,
} from '@/components/editor/document-tabs-sidebar';

const genreLabels: Record<string, string> = {
  fantasy: 'Huyền Huyễn',
  scifi: 'Khoa Huyễn',
  romance: 'Lãng Mạn',
  mystery: 'Trinh Thám',
  thriller: 'Giật Gân',
  horror: 'Kinh Dị',
  literary: 'Văn Học',
  historical: 'Lịch Sử',
  blank: 'Chung',
};

interface Chapter {
  id: string;
  projectId: string;
  title: string;
  wordCount: number;
  status: string;
  orderIndex: number;
  parentId?: string | null;
}

export default function ProjectEditorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<any>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [showChapterDialog, setShowChapterDialog] = useState(false);
  const [chapterParentId, setChapterParentId] = useState<string | null>(null);
  const [creatingChapter, setCreatingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [searchChapter, setSearchChapter] = useState('');
  const [activeTab, setActiveTab] = useState<'chapters' | 'overview'>(
    'chapters'
  );
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedIds((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    genre: 'fantasy',
    coverUrl: '',
    wordCountGoal: 50000,
    status: 'planning',
  });

  const openEditDialog = (proj: any) => {
    setEditForm({
      title: proj?.title || '',
      subtitle: proj?.subtitle || '',
      description: proj?.description || '',
      genre: proj?.genre || 'fantasy',
      coverUrl: proj?.coverUrl || '',
      wordCountGoal: proj?.wordCountGoal || 50000,
      status: proj?.status || 'planning',
    });
    setShowEditDialog(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn một tệp hình ảnh hợp lệ (PNG, JPG, WebP)');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 8MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setEditForm((prev) => ({ ...prev, coverUrl: compressed }));
          toast.success('Đã tải ảnh bìa lên thành công!');
        } else {
          setEditForm((prev) => ({ ...prev, coverUrl: dataUrl }));
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const saveProjectEdit = async () => {
    if (!editForm.title.trim()) {
      toast.error('Tên tác phẩm không được để trống');
      return;
    }
    setSavingEdit(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editForm.title.trim(),
          subtitle: editForm.subtitle.trim(),
          description: editForm.description.trim(),
          genre: editForm.genre,
          coverUrl: editForm.coverUrl.trim(),
          wordCountGoal: Number(editForm.wordCountGoal) || 50000,
          status: editForm.status,
        }),
      });
      toast.success('Đã cập nhật thông tin và ảnh bìa thành công!');
      setShowEditDialog(false);
      fetchData();
    } catch (e: any) {
      toast.error('Lỗi khi lưu: ' + (e.message || 'Không xác định'));
    } finally {
      setSavingEdit(false);
    }
  };

  const startRename = (ch: { id: string; title?: string }) => {
    setEditingChapterId(ch.id);
    setEditingTitle(ch.title || '');
  };

  const cancelRename = () => {
    setEditingChapterId(null);
    setEditingTitle('');
  };

  const saveChapterRename = async (chapterId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      toast.error('Tên chương không được để trống');
      return;
    }
    const prevChapters = [...chapters];
    setChapters((prev) =>
      prev.map((c) => (c.id === chapterId ? { ...c, title: trimmed } : c))
    );
    setEditingChapterId(null);

    try {
      await apiFetch(`/api/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: trimmed }),
      });
      playSuccessSound();
      toast.success('Đã cập nhật tên chương thành công');
      fetchData();
      pushSync().catch(() => {});
    } catch (e: any) {
      toast.error('Lỗi khi sửa tên chương: ' + (e.message || ''));
      setChapters(prevChapters);
    }
  };

  const moveChapter = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;

    const newChapters = [...chapters];
    const temp = newChapters[index];
    newChapters[index] = newChapters[targetIndex];
    newChapters[targetIndex] = temp;
    setChapters(newChapters);

    try {
      await apiFetch(`/api/projects/${projectId}/chapters/reorder`, {
        method: 'POST',
        body: JSON.stringify({ chapterIds: newChapters.map((c) => c.id) }),
      });
      toast.success(`Đã chuyển vị trí chương`);
      pushSync().catch(() => {});
    } catch (e: any) {
      toast.error('Lỗi sắp xếp: ' + (e.message || ''));
      fetchData();
    }
  };

  const fetchGenerationRef = useRef(0);

  useEffect(() => {
    setCurrentProjectId(projectId);
    fetchData();
    pullSync(true)
      .then(() => {
        fetchData();
      })
      .catch(() => {});

    const handleSync = () => {
      fetchData();
    };
    const handleChapterDeleted = () => {
      fetchData();
    };
    const handleWorkspace = () => {
      const active = getCachedChapters(projectId);
      setChapters(active);
      setProject((prev: any) =>
        prev ? { ...prev, ...getProjectChapterStats(active, projectId) } : prev
      );
    };
    window.addEventListener('novelist-sync-updated', handleSync);
    window.addEventListener('novelist-chapters-deleted', handleChapterDeleted);
    window.addEventListener('novelist-workspace-updated', handleWorkspace);
    return () => {
      window.removeEventListener('novelist-sync-updated', handleSync);
      window.removeEventListener(
        'novelist-chapters-deleted',
        handleChapterDeleted
      );
      window.removeEventListener('novelist-workspace-updated', handleWorkspace);
    };
  }, [projectId]);

  const fetchData = async () => {
    setFetchError('');
    const gen = ++fetchGenerationRef.current;
    try {
      const [projRes] = await Promise.all([
        apiFetch(`/api/projects/${projectId}`),
        apiFetch(`/api/projects/${projectId}/chapters`),
      ]);
      if (gen !== fetchGenerationRef.current) return;

      const activeChapters = getCachedChapters(projectId);
      setProject({
        ...projRes.project,
        ...getProjectChapterStats(activeChapters, projectId),
      });
      setChapters(activeChapters);
    } catch (e: any) {
      if (gen === fetchGenerationRef.current) {
        setFetchError(e.message || 'Không thể tải dự án');
      }
    } finally {
      if (gen === fetchGenerationRef.current) {
        setLoading(false);
      }
    }
  };

  const createChapter = async () => {
    if (!newChapterTitle.trim() || creatingChapter) return;
    setCreatingChapter(true);
    try {
      const maxOrder =
        chapters.length > 0
          ? Math.max(...chapters.map((c) => c.orderIndex || 0))
          : 0;
      await apiFetch(`/api/projects/${projectId}/chapters`, {
        method: 'POST',
        body: JSON.stringify({
          title: newChapterTitle.trim(),
          orderIndex: maxOrder + 1,
          status: 'outline',
          parentId: chapterParentId,
        }),
      });
      setNewChapterTitle('');
      setShowChapterDialog(false);
      if (chapterParentId)
        setExpandedIds((prev) => ({ ...prev, [chapterParentId]: true }));
      playSuccessSound();
      toast.success('Tạo chương mới thành công');
      fireConfetti({ type: 'stardust', particleCount: 20 });
      await fetchData();
      pushSync().catch(() => {});
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingChapter(false);
    }
  };

  const deleteChapter = async (id: string) => {
    if (!confirm('Xóa chương này?')) return;
    try {
      const res = await deleteChapterWithSync({
        projectId,
        chapterId: id,
      });
      if (!res.success) {
        toast.error(res.error || 'Lỗi khi xóa chương');
        return;
      }
      playDeleteSound();
      toast.success('Đã xóa chương');
      await fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading)
    return (
      <DashboardLayout projectId={projectId} mode="project">
        <div className="p-6">
          <StudioState
            busy
            title="Đang mở tác phẩm"
            description="Tải mục lục và bản thảo…"
          />
        </div>
      </DashboardLayout>
    );
  if (fetchError || !project)
    return (
      <DashboardLayout projectId={projectId} mode="project">
        <div className="p-6">
          <StudioState
            title="Chưa thể mở tác phẩm"
            description={fetchError || 'Không tìm thấy tác phẩm'}
            action={
              <Button
                onClick={() => {
                  setLoading(true);
                  void fetchData();
                }}
              >
                Thử lại
              </Button>
            }
          />
        </div>
      </DashboardLayout>
    );

  const goalProgress =
    project.wordCountGoal && project.wordCount
      ? Math.min(
          100,
          Math.round(((project.wordCount || 0) / project.wordCountGoal) * 100)
        )
      : 0;

  return (
    <DashboardLayout projectId={projectId} mode="project">
      <div className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10">
        <PageHeader
          eyebrow="Phòng viết của bạn"
          title={project.title}
          description={
            project.subtitle ||
            'Từng chương một, câu chuyện của bạn đang thành hình.'
          }
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setChapterParentId(null);
                  setNewChapterTitle('');
                  setShowChapterDialog(true);
                }}
              >
                <Plus />
                Thêm chương
              </Button>
              {chapters.length > 0 && (
                <Button asChild>
                  <Link href={'/editor/' + projectId + '/' + chapters[0].id}>
                    Vào viết <ChevronRight />
                  </Link>
                </Button>
              )}
            </>
          }
        />
        <div className="mb-8 flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:flex-row sm:p-6">
          <BookCoverArt
            title={project.title}
            genre={project.genre}
            coverUrl={project.coverUrl}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge variant="outline">
                {genreLabels[project.genre] || 'Tác phẩm'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(project)}
              >
                <Edit3 />
                Sửa thông tin & bìa
              </Button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground break-words">
              {project.description ||
                'Thêm vài dòng giới thiệu cho câu chuyện của bạn.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span>
                <strong>{(project.wordCount || 0).toLocaleString()}</strong>{' '}
                <span className="text-muted-foreground">từ đã viết</span>
              </span>
              <span>
                <strong>{chapters.length}</strong>{' '}
                <span className="text-muted-foreground">chương</span>
              </span>
              {project.wordCountGoal > 0 && (
                <span className="text-primary">{goalProgress}% mục tiêu</span>
              )}
            </div>
            {project.wordCountGoal > 0 && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: goalProgress + '%' }}
                />
              </div>
            )}
          </div>
        </div>
        {/* Main Layout Area */}
        <div className="studio-surface min-w-0 overflow-hidden">
          {/* Chapters Section (Full-width on mobile when activeTab=chapters, sidebar on desktop) */}
          <aside className="flex w-full min-w-0 flex-col">
            <div className="p-3 sm:p-4 border-b space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">
                  Danh sách chương ({chapters.length})
                </h2>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {(project.wordCount || 0).toLocaleString()} từ
                </span>
              </div>

              {/* Word goal progress indicator */}
              {project.wordCountGoal ? (
                <div className="p-2.5 bg-muted/40 rounded-lg border space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Mục tiêu:</span>
                    <span className="font-semibold text-primary">
                      {goalProgress}% (
                      {(project.wordCount || 0).toLocaleString()} /{' '}
                      {project.wordCountGoal.toLocaleString()} từ)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${goalProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {/* Search filter */}
              {chapters.length > 3 && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    aria-label="Tìm chương"
                    placeholder="Tìm chương..."
                    value={searchChapter}
                    onChange={(e) => setSearchChapter(e.target.value)}
                    className="pl-8 h-8 text-xs bg-muted/30"
                  />
                </div>
              )}
            </div>

            {/* Chapters and Subtabs Tree List */}
            <div className="p-3 sm:p-5 space-y-2">
              {chapters.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Chưa có chương nào. Chọn “Thêm chương” để bắt đầu câu chuyện.
                </div>
              ) : (
                (() => {
                  const tree = buildTabTree(chapters);
                  const renderTreeItem = (node: TabTreeNode) => {
                    const hasChildren =
                      node.children && node.children.length > 0;
                    const isExpanded = expandedIds[node.id] !== false;
                    const isEditing = editingChapterId === node.id;

                    return (
                      <div key={node.id} className="space-y-1">
                        <div className="group flex items-center gap-1.5 p-2 rounded-xl border border-border/60 bg-card hover:border-primary/50 hover:bg-accent/40 transition-all shadow-2xs">
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={(e) => toggleExpand(node.id, e)}
                              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors shrink-0"
                              title={
                                isExpanded
                                  ? 'Thu gọn thẻ con'
                                  : 'Mở rộng thẻ con'
                              }
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}

                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />

                          {isEditing ? (
                            <div
                              className="flex-1 min-w-0 flex items-center gap-1.5 py-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Input
                                value={editingTitle}
                                onChange={(e) =>
                                  setEditingTitle(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    saveChapterRename(node.id);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelRename();
                                  }
                                }}
                                className="h-8 text-xs font-medium py-1 px-2.5 flex-1 bg-background border-primary/50 focus-visible:ring-1"
                                autoFocus
                                aria-label="Sửa tên chương"
                                placeholder="Nhập tên thẻ..."
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 shrink-0"
                                onClick={() => saveChapterRename(node.id)}
                                title="Lưu (Enter)"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                                onClick={cancelRename}
                                title="Hủy (Esc)"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Link
                                href={`/editor/${projectId}/${node.id}`}
                                className="flex-1 min-w-0"
                              >
                                <div className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  {node.title}
                                </div>
                                <div className="flex gap-2 items-center mt-0.5">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 font-normal"
                                  >
                                    {node.status || 'draft'}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground">
                                    {(node.wordCount || 0).toLocaleString()} từ
                                  </span>
                                  {hasChildren && (
                                    <span className="text-[10px] text-primary font-medium">
                                      ({node.children.length} thẻ con)
                                    </span>
                                  )}
                                </div>
                              </Link>

                              {/* Actions */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                {node.depth < 2 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                    onClick={() => {
                                      setChapterParentId(node.id);
                                      setNewChapterTitle(
                                        node.title +
                                          ' - Thẻ con ' +
                                          ((node.children || []).length + 1)
                                      );
                                      setShowChapterDialog(true);
                                    }}
                                    title="Thêm thẻ con (+)"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-primary" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    startRename(node);
                                  }}
                                  title="Sửa tên thẻ"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  onClick={() => deleteChapter(node.id)}
                                  title="Xóa thẻ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Nested child subtabs */}
                        {hasChildren && isExpanded && (
                          <div className="ml-5 pl-2.5 border-l-2 border-border/70 hover:border-primary/40 transition-colors space-y-1 my-1">
                            {node.children.map((child) =>
                              renderTreeItem(child)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return tree
                    .filter((ch) =>
                      (ch.title || '')
                        .toLowerCase()
                        .includes(searchChapter.toLowerCase())
                    )
                    .map((root) => renderTreeItem(root));
                })()
              )}
            </div>

            <div className="p-3 border-t text-[11px] text-muted-foreground hidden md:block">
              <p>Chọn một chương để mở bản thảo và tiếp tục viết.</p>
            </div>
          </aside>
        </div>

        {/* Edit Project Dialog */}
        <Dialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          className="max-w-xl"
        >
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" />
                <span>Chỉnh sửa thông tin tác phẩm</span>
              </DialogTitle>
              <DialogDescription>
                Tùy chỉnh tên tác phẩm, ảnh bìa, tóm tắt nội dung và thể loại.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Live Cover Preview & Upload Row */}
              <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start p-3.5 bg-muted/30 border border-border/70 rounded-xl">
                <div className="shrink-0 flex flex-col items-center">
                  <BookCoverArt
                    title={editForm.title || 'Tiêu đề tác phẩm'}
                    genre={editForm.genre}
                    coverUrl={editForm.coverUrl}
                    wordCount={project?.wordCount || 0}
                    size="sm"
                    className="shadow-md"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1.5 font-medium">
                    Bìa xem trước
                  </span>
                </div>

                <div className="flex-1 min-w-0 space-y-3 w-full">
                  <div>
                    <label className="text-xs font-semibold block mb-1.5 flex items-center justify-between">
                      <span>Ảnh bìa tác phẩm</span>
                      {editForm.coverUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm((prev) => ({ ...prev, coverUrl: '' }))
                          }
                          className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Gỡ ảnh bìa
                        </button>
                      ) : null}
                    </label>

                    <div className="flex gap-2 mb-2">
                      <Input
                        aria-label="Link ảnh bìa"
                        placeholder="Dán link ảnh bìa (URL https://...)"
                        value={
                          editForm.coverUrl.startsWith('data:')
                            ? '[Ảnh tải từ máy tính]'
                            : editForm.coverUrl
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val.startsWith('[Ảnh')) {
                            setEditForm((prev) => ({ ...prev, coverUrl: val }));
                          }
                        }}
                        className="text-xs h-9"
                      />
                      <label className="shrink-0">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 px-3 text-xs gap-1.5 cursor-pointer"
                          asChild
                        >
                          <span>
                            <Upload className="w-3.5 h-3.5 text-primary" />
                            <span>Tải ảnh</span>
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/jpg"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Hỗ trợ tệp PNG, JPG hoặc dán liên kết URL ảnh. Hệ thống sẽ
                      tối ưu hóa để hiển thị 3D sắc nét.
                    </p>
                  </div>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Tên tác phẩm *
                  </label>
                  <Input
                    aria-label="Tên tác phẩm"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Thiên Mệnh Kỷ"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Tên phụ / Bút danh
                  </label>
                  <Input
                    aria-label="Phụ đề / Bút danh"
                    value={editForm.subtitle}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        subtitle: e.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Quyển 1: Khởi nguyên"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Genre & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Thể loại
                  </label>
                  <select
                    aria-label="Thể loại tác phẩm"
                    value={editForm.genre}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        genre: e.target.value,
                      }))
                    }
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    {Object.entries(genreLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Trạng thái
                  </label>
                  <select
                    aria-label="Trạng thái sáng tác"
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="planning">Đang lập dàn ý</option>
                    <option value="drafting">Đang sáng tác</option>
                    <option value="revising">Đang biên tập</option>
                    <option value="completed">Đã hoàn thành</option>
                    <option value="published">Đã xuất bản</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Mục tiêu số từ
                  </label>
                  <Input
                    type="number"
                    aria-label="Mục tiêu số từ"
                    value={editForm.wordCountGoal}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        wordCountGoal: Number(e.target.value) || 0,
                      }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold block mb-1">
                  Tóm tắt / Giới thiệu tác phẩm
                </label>
                <Textarea
                  aria-label="Tóm tắt tác phẩm"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Tóm tắt bối cảnh thế giới, nhân vật chính, xung đột mở đầu..."
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditDialog(false)}
              >
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={saveProjectEdit}
                disabled={savingEdit}
                className="bg-primary hover:bg-primary/90"
              >
                {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={showChapterDialog}
          onOpenChange={(open) => {
            if (!creatingChapter) setShowChapterDialog(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {chapterParentId ? 'Thêm thẻ con' : 'Một chương mới'}
              </DialogTitle>
              <DialogDescription>
                Đặt tên cho phần tiếp theo của câu chuyện.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void createChapter();
              }}
            >
              <label
                htmlFor="new-chapter"
                className="mb-2 block text-sm font-medium"
              >
                Tên chương
              </label>
              <Input
                id="new-chapter"
                autoFocus
                value={newChapterTitle}
                onChange={(event) => setNewChapterTitle(event.target.value)}
                placeholder="Ví dụ: Một khởi đầu mới"
                disabled={creatingChapter}
              />
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outline"
                  disabled={creatingChapter}
                  onClick={() => setShowChapterDialog(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={creatingChapter || !newChapterTitle.trim()}
                >
                  {creatingChapter ? 'Đang tạo…' : 'Thêm chương'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
