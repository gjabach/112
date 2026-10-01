'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  Trash2,
  Pin,
  PinOff,
  Tag,
  X,
  Plus,
  FileText,
  Check,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import type { WikiArticle } from './wiki-sidebar';

const categoryOptions = [
  { id: 'lore', label: '🌍 Bối cảnh / Lore', icon: '🌍' },
  { id: 'character', label: '👤 Nhân vật', icon: '👤' },
  { id: 'chapter_note', label: '📖 Ghi chú chương', icon: '📖' },
  { id: 'world', label: '🏰 Thế giới', icon: '🏰' },
  { id: 'free_note', label: '📝 Ghi chú tự do', icon: '📝' }
];

interface WikiArticleEditorProps {
  article: WikiArticle | null;
  onSave: (data: Partial<WikiArticle>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving?: boolean;
}

export function WikiArticleEditor({
  article,
  onSave,
  onDelete,
  saving = false
}: WikiArticleEditorProps) {
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'free_note',
    summary: '',
    tags: [] as string[],
    icon: '📝',
    pinned: false
  });
  const [newTag, setNewTag] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (article) {
      const newForm = {
        title: article.title || '',
        content: article.content || '',
        category: article.category || 'free_note',
        summary: article.summary || '',
        tags: Array.isArray(article.tags) ? article.tags : [],
        icon: article.icon || getCategoryIcon(article.category),
        pinned: article.pinned || false
      };
      setForm(newForm);
      lastSavedRef.current = JSON.stringify(newForm);
      setAutoSaveStatus('idle');
    } else {
      const newForm = {
        title: '',
        content: '',
        category: 'free_note',
        summary: '',
        tags: [],
        icon: '📝',
        pinned: false
      };
      setForm(newForm);
      lastSavedRef.current = JSON.stringify(newForm);
      setAutoSaveStatus('idle');
    }
  }, [article?.id]);

  const getCategoryIcon = (cat: string) => {
    return categoryOptions.find(c => c.id === cat)?.icon || '📝';
  };

  // Auto-save logic
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (!article?.id) return;

    autoSaveTimerRef.current = setTimeout(async () => {
      const currentFormStr = JSON.stringify(form);
      if (currentFormStr === lastSavedRef.current) return;

      setAutoSaveStatus('saving');
      try {
        await onSave(form);
        lastSavedRef.current = currentFormStr;
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch {
        setAutoSaveStatus('idle');
      }
    }, 2000);
  }, [article?.id, form, onSave]);

  useEffect(() => {
    triggerAutoSave();
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [form.content, form.title, form.summary, form.pinned]);

  const updateForm = (updates: Partial<typeof form>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (!tag || form.tags.includes(tag)) return;
    updateForm({ tags: [...form.tags, tag] });
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    updateForm({ tags: form.tags.filter(t => t !== tag) });
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Tiêu đề bài viết không được để trống');
      return;
    }
    await onSave(form);
    lastSavedRef.current = JSON.stringify(form);
  };

  const handleDelete = async () => {
    if (!article?.id) return;
    if (!confirm(`Bạn có chắc muốn xóa bài "${article.title}"?`)) return;
    await onDelete(article.id);
  };

  // Empty state
  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/5">
        <div className="text-center space-y-3 max-w-sm">
          <FileText className="w-16 h-16 text-muted-foreground/20 mx-auto" />
          <h3 className="font-semibold text-sm text-muted-foreground">Chọn hoặc tạo bài wiki</h3>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Chọn một bài viết từ sidebar bên trái, hoặc tạo bài mới để bắt đầu viết lore, bối cảnh, nhân vật...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Editor Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm p-3 sm:p-4 space-y-3 shrink-0">
        {/* Title */}
        <input
          type="text"
          value={form.title}
          onChange={e => updateForm({ title: e.target.value })}
          placeholder="Tiêu đề bài wiki..."
          className="w-full text-lg sm:text-xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 text-foreground"
        />

        {/* Meta Row */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={form.category}
            onChange={e => {
              const newCat = e.target.value;
              updateForm({ category: newCat, icon: getCategoryIcon(newCat) });
            }}
            className="h-7 border rounded-lg bg-background px-2 text-xs"
          >
            {categoryOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>

          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-xs gap-1 ${form.pinned ? 'text-amber-500' : 'text-muted-foreground'}`}
            onClick={() => updateForm({ pinned: !form.pinned })}
          >
            {form.pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
            {form.pinned ? 'Đã ghim' : 'Ghim'}
          </Button>

          {/* Auto-save indicator */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
            {autoSaveStatus === 'saving' && (
              <><Clock className="w-3 h-3 animate-spin" /> Đang lưu...</>
            )}
            {autoSaveStatus === 'saved' && (
              <><Check className="w-3 h-3 text-emerald-500" /> Đã lưu tự động</>
            )}
          </div>
        </div>

        {/* Summary */}
        <Input
          value={form.summary}
          onChange={e => updateForm({ summary: e.target.value })}
          placeholder="Tóm tắt ngắn (1-2 câu)..."
          className="h-8 text-xs bg-muted/20"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <Textarea
          value={form.content}
          onChange={e => updateForm({ content: e.target.value })}
          placeholder={"Viết nội dung tự do ở đây...\n\nBạn có thể mô tả chi tiết lore, bối cảnh thế giới, tiểu sử nhân vật, ghi chú chương, hay bất cứ ý tưởng nào.\n\nViết bao nhiêu tùy thích — không giới hạn!"}
          className="min-h-[calc(100vh-420px)] w-full text-sm leading-relaxed resize-none bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0 placeholder:text-muted-foreground/30"
        />
      </div>

      {/* Tags & Action Footer */}
      <div className="border-t bg-card/80 backdrop-blur-sm p-3 sm:p-4 space-y-3 shrink-0">
        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {form.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5 gap-1 font-normal">
              #{tag}
              <button onClick={() => handleRemoveTag(tag)} className="hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
          <div className="flex items-center gap-1">
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="Thêm tag..."
              className="h-6 w-24 text-[10px] px-2"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleAddTag}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1.5"
            onClick={handleDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xóa bài
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Đang lưu...' : 'Lưu bài viết'}
          </Button>
        </div>
      </div>
    </div>
  );
}
