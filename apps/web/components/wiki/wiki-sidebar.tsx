'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Pin, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface WikiArticle {
  id: string;
  projectId: string;
  title: string;
  content: string;
  category: string;
  summary: string;
  tags: string[];
  icon: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export type WikiCategory = 'all' | 'lore' | 'character' | 'chapter_note' | 'world' | 'free_note';

export const categories: { id: WikiCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'Tất cả', icon: '📚' },
  { id: 'lore', label: 'Bối cảnh', icon: '🌍' },
  { id: 'character', label: 'Nhân vật', icon: '👤' },
  { id: 'chapter_note', label: 'Ghi chú chương', icon: '📖' },
  { id: 'world', label: 'Thế giới', icon: '🏰' },
  { id: 'free_note', label: 'Tự do', icon: '📝' }
];

interface WikiSidebarProps {
  articles: WikiArticle[];
  activeArticleId: string | null;
  onSelectArticle: (article: WikiArticle) => void;
  onCreateNew: () => void;
  className?: string;
}

export function WikiSidebar({
  articles,
  activeArticleId,
  onSelectArticle,
  onCreateNew,
  className = ''
}: WikiSidebarProps) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<WikiCategory>('all');

  const filtered = articles
    .filter(a => {
      const matchSearch =
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.content.toLowerCase().includes(search.toLowerCase()) ||
        a.summary.toLowerCase().includes(search.toLowerCase()) ||
        (a.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchCategory = filterCategory === 'all' || a.category === filterCategory;
      return matchSearch && matchCategory;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });

  const getCategoryConfig = (cat: string) => {
    return categories.find(c => c.id === cat) || categories[0];
  };

  return (
    <div className={`flex flex-col h-full bg-card border-r border-border/60 ${className}`}>
      {/* Search */}
      <div className="p-3 space-y-2.5 border-b border-border/50">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm bài viết..."
            className="h-9 text-xs pl-9 bg-muted/20"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`text-[10px] px-2 py-1 rounded-lg transition-all flex items-center gap-1 ${
                filterCategory === cat.id
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Article List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p>Chưa có bài viết nào</p>
            <p className="text-[10px] mt-1">Bấm nút bên dưới để tạo bài mới</p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map(article => {
              const catCfg = getCategoryConfig(article.category);
              const isActive = activeArticleId === article.id;
              return (
                <motion.button
                  key={article.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => onSelectArticle(article)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all text-xs group ${
                    isActive
                      ? 'bg-primary/10 border border-primary/30 shadow-xs'
                      : 'hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5 shrink-0">{article.icon || catCfg.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {article.pinned && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
                        <span className={`font-semibold truncate block ${
                          isActive ? 'text-primary' : 'text-foreground group-hover:text-primary'
                        }`}>
                          {article.title || 'Chưa đặt tên'}
                        </span>
                      </div>
                      {article.summary && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {article.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal">
                          {catCfg.icon} {catCfg.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Create New Button */}
      <div className="p-3 border-t border-border/50">
        <Button
          size="sm"
          onClick={onCreateNew}
          className="w-full h-9 text-xs font-semibold shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Tạo bài wiki mới
        </Button>
        <p className="text-[10px] text-center text-muted-foreground mt-1.5">
          {articles.length} bài viết
        </p>
      </div>
    </div>
  );
}
