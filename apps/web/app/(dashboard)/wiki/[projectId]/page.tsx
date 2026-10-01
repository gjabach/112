'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/utils';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, Plus, ChevronLeft } from 'lucide-react';
import { WikiSidebar } from '@/components/wiki/wiki-sidebar';
import { WikiArticleEditor } from '@/components/wiki/wiki-article-editor';
import type { WikiArticle } from '@/components/wiki/wiki-sidebar';

export default function WikiPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [activeArticle, setActiveArticle] = useState<WikiArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mobileShowEditor, setMobileShowEditor] = useState(false);

  useEffect(() => {
    if (projectId) fetchArticles();
  }, [projectId]);

  const fetchArticles = async () => {
    try {
      const res = await apiFetch(`/api/projects/${projectId}/wiki`);
      const list = Array.isArray(res?.articles) ? res.articles : [];
      setArticles(list);

      // Refresh active article data if it still exists
      if (activeArticle) {
        const updated = list.find((a: WikiArticle) => a.id === activeArticle.id);
        if (updated) {
          setActiveArticle(updated);
        } else {
          setActiveArticle(null);
          setMobileShowEditor(false);
        }
      }
    } catch (e: any) {
      setArticles([]);
      toast.error(e.message || 'Lỗi tải danh sách wiki');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectArticle = (article: WikiArticle) => {
    setActiveArticle(article);
    setMobileShowEditor(true);
  };

  const handleCreateNew = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/wiki`, {
        method: 'POST',
        body: JSON.stringify({
          title: 'Bài viết mới',
          content: '',
          category: 'free_note',
          summary: '',
          tags: [],
          icon: '📝',
          pinned: false
        })
      });
      if (res?.article) {
        toast.success('Đã tạo bài wiki mới!');
        await fetchArticles();
        setActiveArticle(res.article);
        setMobileShowEditor(true);
      }
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi tạo bài mới');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (data: Partial<WikiArticle>) => {
    if (!activeArticle?.id) return;
    setSaving(true);
    try {
      await apiFetch(`/api/wiki/${activeArticle.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      await fetchArticles();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/wiki/${id}`, { method: 'DELETE' });
      toast.success('Đã xóa bài viết');
      setActiveArticle(null);
      setMobileShowEditor(false);
      await fetchArticles();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi xóa');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col w-full max-w-full overflow-x-clip">
      {/* Header */}
      <header className="border-b bg-card/95 backdrop-blur-md sticky top-0 z-20 shadow-xs">
        <div className="flex items-center justify-between gap-3 p-3 sm:p-4 max-w-full">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile back from editor */}
            {mobileShowEditor ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 md:hidden shrink-0"
                onClick={() => setMobileShowEditor(false)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            ) : null}
            <Link href={`/editor/${projectId}`} className="shrink-0 hidden md:block">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            {!mobileShowEditor && (
              <Link href={`/editor/${projectId}`} className="shrink-0 md:hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg flex items-center gap-2 truncate">
                <BookOpen className="w-4 h-4 text-cyan-500 shrink-0" />
                <span className="truncate">Lore Wiki</span>
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-normal shrink-0">
                  {articles.length} bài
                </Badge>
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                Viết lore, bối cảnh, nhân vật và ghi chú tự do
              </p>
            </div>
          </div>

          <Button size="sm" onClick={handleCreateNew} disabled={saving} className="h-8 text-xs font-semibold shadow-xs shrink-0">
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Tạo bài mới</span>
            <span className="sm:hidden">Tạo</span>
          </Button>
        </div>
      </header>

      {/* Main 2-Column Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar - hidden on mobile when editor is showing */}
        <div className={`w-full md:w-72 lg:w-80 shrink-0 ${
          mobileShowEditor ? 'hidden md:flex' : 'flex'
        }`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-xs text-muted-foreground animate-pulse">Đang tải...</div>
            </div>
          ) : (
            <WikiSidebar
              articles={articles}
              activeArticleId={activeArticle?.id || null}
              onSelectArticle={handleSelectArticle}
              onCreateNew={handleCreateNew}
              className="w-full"
            />
          )}
        </div>

        {/* Article Editor - hidden on mobile when sidebar is showing */}
        <div className={`flex-1 min-w-0 flex ${
          mobileShowEditor ? 'flex' : 'hidden md:flex'
        }`}>
          <WikiArticleEditor
            article={activeArticle}
            onSave={handleSave}
            onDelete={handleDelete}
            saving={saving}
          />
        </div>
      </div>
    </div>
  );
}
