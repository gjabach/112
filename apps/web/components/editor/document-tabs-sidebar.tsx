'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  MoreVertical, 
  ChevronRight, 
  ChevronDown, 
  Edit3, 
  Copy, 
  Trash2, 
  ChevronUp, 
  PanelLeftClose, 
  PanelLeft, 
  FolderPlus,
  Check,
  X,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { playPopSound, playSuccessSound, playDeleteSound } from '@/lib/sound';

export interface ChapterTab {
  id: string;
  projectId: string;
  title: string;
  orderIndex: number;
  wordCount?: number;
  status?: string;
  parentId?: string | null;
  content?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface TabTreeNode extends ChapterTab {
  children: TabTreeNode[];
  depth: number;
}

interface DocumentTabsSidebarProps {
  projectId: string;
  currentChapterId: string;
  chapters: ChapterTab[];
  isOpen: boolean;
  onToggle: () => void;
  onSelectTab: (chapterId: string) => void;
  onCreateTab: (title: string, parentId?: string | null) => Promise<string | void>;
  onRenameTab: (chapterId: string, newTitle: string) => Promise<void>;
  onDeleteTab: (chapterId: string) => Promise<void>;
  onDuplicateTab: (chapterId: string) => Promise<void>;
  onMoveTab: (chapterId: string, direction: 'up' | 'down') => Promise<void>;
  className?: string;
}

export function buildTabTree(chapters: ChapterTab[]): TabTreeNode[] {
  if (!Array.isArray(chapters) || chapters.length === 0) return [];

  const compareSiblings = (a: ChapterTab, b: ChapterTab) => {
    const orderA = typeof a.orderIndex === 'number' ? a.orderIndex : 0;
    const orderB = typeof b.orderIndex === 'number' ? b.orderIndex : 0;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = a.createdAt || 0;
    const timeB = b.createdAt || 0;
    if (timeA !== timeB) return timeA - timeB;
    return String(a.title || '').localeCompare(String(b.title || ''), 'vi', { numeric: true });
  };

  const idMap = new Map<string, TabTreeNode>();
  chapters.forEach(c => {
    idMap.set(c.id, { ...c, children: [], depth: 0 });
  });

  const roots: TabTreeNode[] = [];

  chapters.forEach(c => {
    const node = idMap.get(c.id);
    if (!node) return;

    if (c.parentId && idMap.has(c.parentId)) {
      const parent = idMap.get(c.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const setDepths = (nodes: TabTreeNode[], depth: number) => {
    nodes.sort(compareSiblings);
    nodes.forEach(n => {
      n.depth = depth;
      if (n.children.length > 0) {
        setDepths(n.children, depth + 1);
      }
    });
  };

  setDepths(roots, 0);
  return roots;
}

export function flattenTabTree(roots: TabTreeNode[]): ChapterTab[] {
  const result: ChapterTab[] = [];
  const traverse = (node: TabTreeNode) => {
    result.push(node);
    if (node.children && node.children.length > 0) {
      node.children.forEach(traverse);
    }
  };
  roots.forEach(traverse);
  return result;
}

export function DocumentTabsSidebar({
  projectId,
  currentChapterId,
  chapters,
  isOpen,
  onToggle,
  onSelectTab,
  onCreateTab,
  onRenameTab,
  onDeleteTab,
  onDuplicateTab,
  onMoveTab,
  className = ''
}: DocumentTabsSidebarProps) {
  // State for expanded parent tabs (defaults to expanded)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    chapters.forEach(c => {
      init[c.id] = true;
    });
    return init;
  });

  // State for inline renaming
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // State for adding child tab inline
  const [addingChildUnderId, setAddingChildUnderId] = useState<string | null>(null);
  const [newSubtabTitle, setNewSubtabTitle] = useState('');

  // State for open context menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenuId]);

  const tree = buildTabTree(chapters);

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedIds(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id]
    }));
  };

  const handleStartRename = (tab: ChapterTab, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingTitle(tab.title || '');
    setActiveMenuId(null);
  };

  const handleSaveRename = async (tabId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      toast.error('Tên thẻ không được để trống');
      return;
    }
    setEditingTabId(null);
    try {
      await onRenameTab(tabId, trimmed);
      playSuccessSound();
      toast.success('Đã đổi tên thẻ');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi đổi tên thẻ');
    }
  };

  const handleStartAddSubtab = (parentTabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAddingChildUnderId(parentTabId);
    setNewSubtabTitle('');
    setActiveMenuId(null);
    setExpandedIds(prev => ({ ...prev, [parentTabId]: true }));
  };

  const handleConfirmAddSubtab = async (parentTabId: string) => {
    const trimmed = newSubtabTitle.trim();
    if (!trimmed) {
      setAddingChildUnderId(null);
      return;
    }
    setAddingChildUnderId(null);
    try {
      const createdId = await onCreateTab(trimmed, parentTabId);
      playSuccessSound();
      toast.success(`Đã tạo thẻ con "${trimmed}"`);
      if (createdId) {
        onSelectTab(createdId);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tạo thẻ con');
    }
  };

  const handleCreateRootTab = async () => {
    const rootCount = chapters.filter(c => !c.parentId).length;
    const defaultTitle = `Thẻ ${rootCount + 1}`;
    try {
      const createdId = await onCreateTab(defaultTitle, null);
      playSuccessSound();
      toast.success(`Đã thêm "${defaultTitle}"`);
      if (createdId) {
        onSelectTab(createdId);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tạo thẻ');
    }
  };

  // Recursive tab renderer
  const renderTabNode = (node: TabTreeNode, isLastChild: boolean) => {
    const isActive = node.id === currentChapterId;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds[node.id] !== false;
    const isEditing = editingTabId === node.id;
    const isAddingChild = addingChildUnderId === node.id;

    return (
      <div key={node.id} className="relative group/tab flex flex-col">
        {/* Tab Row Container */}
        <div
          onClick={() => {
            if (!isEditing) {
              onSelectTab(node.id);
            }
          }}
          className={`
            relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all select-none
            ${isActive 
              ? 'bg-primary/15 text-primary font-semibold shadow-2xs border border-primary/25' 
              : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground'
            }
          `}
        >
          {/* Caret expand/collapse button for parent nodes */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(node.id, e)}
              className="p-0.5 -ml-1 text-muted-foreground hover:text-foreground rounded transition-colors shrink-0"
              title={isExpanded ? "Thu gọn thẻ con" : "Mở rộng thẻ con"}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-2.5 shrink-0" />
          )}

          {/* Document Tab Icon */}
          <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />

          {/* Title or inline edit input */}
          {isEditing ? (
            <div 
              className="flex-1 flex items-center gap-1 min-w-0" 
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveRename(node.id);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingTabId(null);
                  }
                }}
                className="h-6 text-xs px-1.5 py-0.5 bg-background border-primary flex-1"
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleSaveRename(node.id)}
                className="p-0.5 text-emerald-500 hover:text-emerald-600 rounded"
                title="Lưu (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditingTabId(null)}
                className="p-0.5 text-muted-foreground hover:text-foreground rounded"
                title="Hủy (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span className="truncate flex-1" title={node.title}>
              {node.title || 'Thẻ không tên'}
            </span>
          )}

          {/* Word count pill (desktop hover or active) */}
          {node.wordCount ? (
            <span className="text-[10px] text-muted-foreground/80 font-mono opacity-0 group-hover/tab:opacity-100 transition-opacity">
              {node.wordCount.toLocaleString()}t
            </span>
          ) : null}

          {/* Three dots menu trigger */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(activeMenuId === node.id ? null : node.id);
              }}
              className={`
                p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 transition-opacity
                ${activeMenuId === node.id ? 'opacity-100 bg-background text-foreground' : 'opacity-0 group-hover/tab:opacity-100'}
              `}
              title="Tùy chọn thẻ"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {/* Context Menu Dropdown */}
            {activeMenuId === node.id && (
              <div
                ref={menuRef}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-48 bg-card border border-border/80 rounded-xl shadow-xl z-50 py-1 text-xs animate-in fade-in-50 zoom-in-95 duration-100"
              >
                <button
                  type="button"
                  onClick={(e) => handleStartAddSubtab(node.id, e)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-primary" />
                  <span>Thêm thẻ con</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleStartRename(node, e)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Đổi tên thẻ</span>
                </button>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    await onDuplicateTab(node.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Nhân bản thẻ</span>
                </button>
                <div className="my-1 border-t border-border/50" />
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    await onMoveTab(node.id, 'up');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Chuyển lên trên</span>
                </button>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    await onMoveTab(node.id, 'down');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Chuyển xuống dưới</span>
                </button>
                <div className="my-1 border-t border-border/50" />
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    const promptMsg = hasChildren 
                      ? `Xóa thẻ "${node.title}" và toàn bộ ${node.children.length} thẻ con trực thuộc?`
                      : `Xóa thẻ "${node.title}"?`;
                    if (confirm(promptMsg)) {
                      await onDeleteTab(node.id);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-destructive/10 text-destructive transition-colors text-left font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa thẻ</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inline Subtab Input when creating a new child */}
        {isAddingChild && (
          <div className="ml-5 pl-2.5 my-1 border-l-2 border-primary/50 flex items-center gap-1.5">
            <FileText className="w-3 h-3 text-primary shrink-0" />
            <Input
              value={newSubtabTitle}
              onChange={(e) => setNewSubtabTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmAddSubtab(node.id);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setAddingChildUnderId(null);
                }
              }}
              placeholder="Tên thẻ con..."
              className="h-6 text-xs px-2 py-0.5 bg-background border-primary/50 flex-1"
              autoFocus
            />
            <button
              type="button"
              onClick={() => handleConfirmAddSubtab(node.id)}
              className="p-1 text-emerald-500 hover:text-emerald-600 rounded shrink-0"
              title="Tạo (Enter)"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setAddingChildUnderId(null)}
              className="p-1 text-muted-foreground hover:text-foreground rounded shrink-0"
              title="Hủy (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Render Nested Children with Google Docs-style Indentation Guide Line */}
        {hasChildren && isExpanded && (
          <div className="ml-4 pl-2.5 border-l-2 border-border/70 hover:border-primary/40 transition-colors my-0.5 space-y-0.5">
            {node.children.map((child, idx) =>
              renderTabNode(child, idx === node.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) {
    return (
      <div className="shrink-0 flex items-center">
        <button
          type="button"
          onClick={onToggle}
          className="h-10 px-2 py-1 text-muted-foreground hover:text-primary hover:bg-card border-r border-border/60 flex items-center gap-1.5 text-xs font-medium transition-all"
          title="Hiện Các thẻ trong tài liệu"
        >
          <PanelLeft className="w-4 h-4 text-primary" />
          <span className="hidden xl:inline">Thẻ tài liệu</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      className={`
        w-64 lg:w-72 h-full border-r border-border/70 bg-card/95 backdrop-blur-md flex flex-col shrink-0 z-20 select-none
        ${className}
      `}
    >
      {/* Header matching Google Docs "Các thẻ trong tài liệu" */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-border/70">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <h2 className="font-semibold text-xs sm:text-sm text-foreground truncate">
            Các thẻ trong tài liệu
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Add Tab Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            onClick={handleCreateRootTab}
            title="Thêm thẻ mới (+)"
          >
            <Plus className="w-4 h-4" />
          </Button>

          {/* Collapse Sidebar Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            onClick={onToggle}
            title="Thu gọn thanh thẻ"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
        {tree.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Chưa có thẻ nào. Bấm nút <Plus className="w-3 h-3 inline mx-0.5 text-primary" /> để tạo thẻ đầu tiên.
          </div>
        ) : (
          tree.map((root, idx) => renderTabNode(root, idx === tree.length - 1))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/20">
        <span>{chapters.length} thẻ / phân đoạn</span>
        <button
          type="button"
          onClick={handleCreateRootTab}
          className="text-primary hover:underline font-medium flex items-center gap-1 text-[11px]"
        >
          <Plus className="w-3 h-3" />
          <span>Thêm thẻ</span>
        </button>
      </div>
    </aside>
  );
}
