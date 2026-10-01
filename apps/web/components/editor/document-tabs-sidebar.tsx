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
  Check, 
  X, 
  ListTree,
  CornerDownRight,
  CornerUpLeft,
  Layers
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

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
  pos?: number;
}

export interface HeadingTreeNode {
  id: string;
  level: number;
  text: string;
  pos?: number;
  children: HeadingTreeNode[];
}

export function buildHeadingTree(headings: HeadingItem[]): HeadingTreeNode[] {
  if (!Array.isArray(headings) || headings.length === 0) return [];
  const roots: HeadingTreeNode[] = [];
  const stack: HeadingTreeNode[] = [];

  for (const item of headings) {
    const node: HeadingTreeNode = { ...item, children: [] };

    // Pop anything from stack that has level >= current level
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return roots;
}

export function extractHeadingsFromContent(rawContent?: string): HeadingItem[] {
  if (!rawContent) return [];
  const list: HeadingItem[] = [];

  try {
    const json = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    if (json && typeof json === 'object') {
      const walk = (node: any) => {
        if (!node) return;
        if (node.type === 'heading') {
          const level = Number(node.attrs?.level) || 1;
          const text = (node.content || []).map((c: any) => c.text || '').join('').trim();
          if (text) {
            list.push({
              id: `h-${list.length}-${text.slice(0, 15)}`,
              level,
              text
            });
          }
        }
        if (Array.isArray(node.content)) {
          node.content.forEach(walk);
        }
      };
      walk(json);
      if (list.length > 0) return list;
    }
  } catch {}

  const htmlRegex = /<h([1-3])[^>]*>(.*?)<\/h\1>/gi;
  let match;
  while ((match = htmlRegex.exec(rawContent)) !== null) {
    const level = parseInt(match[1], 10);
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) {
      list.push({
        id: `h-${list.length}-${text.slice(0, 15)}`,
        level,
        text
      });
    }
  }

  return list;
}

export interface DocumentTabsSidebarProps {
  projectId: string;
  currentChapterId: string;
  chapters: ChapterTab[];
  headings?: HeadingItem[];
  isOpen: boolean;
  onToggle: () => void;
  onSelectTab: (chapterId: string) => void;
  onJumpToHeading?: (pos?: number, text?: string) => void;
  onCreateTab: (title: string, parentId?: string | null) => Promise<string | void>;
  onRenameTab: (chapterId: string, newTitle: string) => Promise<void>;
  onDeleteTab: (chapterId: string) => Promise<void>;
  onDuplicateTab: (chapterId: string) => Promise<void>;
  onMoveTab: (chapterId: string, direction: 'up' | 'down') => Promise<void>;
  onReparentTab?: (chapterId: string, newParentId: string | null) => Promise<void>;
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
  headings = [],
  isOpen,
  onToggle,
  onSelectTab,
  onJumpToHeading,
  onCreateTab,
  onRenameTab,
  onDeleteTab,
  onDuplicateTab,
  onMoveTab,
  onReparentTab,
  className = ''
}: DocumentTabsSidebarProps) {
  // Sidebar view switcher: Google Docs has "Các thẻ" (Document Tabs) & "Dàn ý" (Outline)
  const [activeView, setActiveView] = useState<'tabs' | 'outline'>('tabs');

  // State for expanded parent tabs (defaults to expanded)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    chapters.forEach(c => {
      init[c.id] = true;
    });
    return init;
  });

  // State for expanded headings in outline
  const [expandedHeadingIds, setExpandedHeadingIds] = useState<Record<string, boolean>>({});

  // State for inline renaming
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

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

  // Active chapter's real-time live heading tree for Document Outline
  const activeChapter = chapters.find(c => c.id === currentChapterId);
  const effectiveHeadings = headings && headings.length > 0
    ? headings
    : extractHeadingsFromContent(activeChapter?.content);
  const activeHeadingTree = buildHeadingTree(effectiveHeadings);

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedIds(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id]
    }));
  };

  const toggleExpandHeading = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedHeadingIds(prev => ({
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

  // Create root tab
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

  // Create subtab under a parent tab (Native Google Docs subtab creation)
  const handleCreateSubTab = async (parentNode: TabTreeNode, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);

    // Google Docs allows max 3 levels: depth 0 (root) -> depth 1 (subtab) -> depth 2 (sub-subtab)
    if (parentNode.depth >= 2) {
      toast.error('Google Docs giới hạn phân cấp tối đa 3 cấp thẻ');
      return;
    }

    // Auto expand the parent node
    setExpandedIds(prev => ({
      ...prev,
      [parentNode.id]: true
    }));

    const childCount = (parentNode.children || []).length + 1;
    const defaultSubTitle = `${parentNode.title} - Thẻ con ${childCount}`;

    try {
      const createdId = await onCreateTab(defaultSubTitle, parentNode.id);
      playSuccessSound();
      toast.success(`Đã tạo thẻ con "${defaultSubTitle}"`);
      if (createdId) {
        onSelectTab(createdId);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tạo thẻ con');
    }
  };

  // Google Docs Document Outline renderer (H1 -> H2 -> H3)
  const renderHeadingNode = (hNode: HeadingTreeNode) => {
    const hasChildren = hNode.children && hNode.children.length > 0;
    const isExpanded = expandedHeadingIds[hNode.id] !== false;

    const levelBadge = hNode.level === 1 ? (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-mono shrink-0">H1</span>
    ) : hNode.level === 2 ? (
      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono shrink-0">H2</span>
    ) : (
      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono shrink-0">H3</span>
    );

    const textStyle = hNode.level === 1 
      ? 'font-semibold text-foreground text-xs' 
      : hNode.level === 2 
        ? 'font-medium text-foreground/90 text-[11.5px]' 
        : 'font-normal text-muted-foreground text-[11px]';

    return (
      <div key={hNode.id} className="group/heading flex flex-col">
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onJumpToHeading) {
              onJumpToHeading(hNode.pos, hNode.text);
            } else {
              window.dispatchEvent(new CustomEvent('novelist-jump-heading', { detail: { pos: hNode.pos, text: hNode.text } }));
            }
          }}
          className={`
            flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors
            hover:bg-primary/10 hover:text-primary select-none
            ${textStyle}
          `}
          title={`Nhảy tới Tiêu đề ${hNode.level}: ${hNode.text}`}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpandHeading(hNode.id, e)}
              className="p-0.5 -ml-1 text-muted-foreground hover:text-foreground rounded transition-colors shrink-0"
              title={isExpanded ? "Thu gọn mục con" : "Mở rộng mục con"}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-2.5 shrink-0" />
          )}

          {levelBadge}

          <span className="truncate flex-1">
            {hNode.text}
          </span>
        </div>

        {/* Nested child headings */}
        {hasChildren && isExpanded && (
          <div className="ml-3 pl-2 border-l border-border/60 space-y-0.5 my-0.5">
            {hNode.children.map(child => renderHeadingNode(child))}
          </div>
        )}
      </div>
    );
  };

  // Find previous sibling at the same level for demotion
  const findPreviousSibling = (node: TabTreeNode, siblings: TabTreeNode[]): TabTreeNode | null => {
    const idx = siblings.findIndex(s => s.id === node.id);
    return idx > 0 ? siblings[idx - 1] : null;
  };

  // Recursive tab renderer matching Google Docs Tabs & Subtabs
  const renderTabNode = (node: TabTreeNode, siblings: TabTreeNode[], isLastChild: boolean) => {
    const isActive = node.id === currentChapterId;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds[node.id] !== false;
    const isEditing = editingTabId === node.id;
    const canHaveSubtab = node.depth < 2; // Google Docs allows max 3 levels (0, 1, 2)
    const prevSibling = findPreviousSibling(node, siblings);
    const canDemote = Boolean(prevSibling && prevSibling.depth < 2 && onReparentTab);
    const canPromote = Boolean(node.parentId && onReparentTab);

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

          {/* Word count pill */}
          {node.wordCount ? (
            <span className="text-[10px] text-muted-foreground/80 font-mono opacity-0 group-hover/tab:opacity-100 transition-opacity">
              {node.wordCount.toLocaleString()}t
            </span>
          ) : null}

          {/* Quick Add Subtab button on hover (Google Docs feature) */}
          {canHaveSubtab && !isEditing && (
            <button
              type="button"
              onClick={(e) => handleCreateSubTab(node, e)}
              className="opacity-0 group-hover/tab:opacity-100 p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0"
              title="Thêm thẻ con (+)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}

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
                className="absolute right-0 top-full mt-1 w-52 bg-card border border-border/80 rounded-xl shadow-xl z-50 py-1 text-xs animate-in fade-in-50 zoom-in-95 duration-100"
              >
                {/* 1. Add Subtab (Native Google Docs feature) */}
                {canHaveSubtab ? (
                  <button
                    type="button"
                    onClick={(e) => handleCreateSubTab(node, e)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-primary font-medium transition-colors text-left"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    <span>Thêm thẻ con</span>
                  </button>
                ) : (
                  <div className="px-3 py-1 text-[11px] text-muted-foreground/60 italic">
                    Đã đạt tối đa 3 cấp thẻ
                  </div>
                )}

                {/* 2. Rename */}
                <button
                  type="button"
                  onClick={(e) => handleStartRename(node, e)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Đổi tên thẻ</span>
                </button>

                {/* 3. Duplicate */}
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

                {/* 4. Demote / Promote (Reparenting) */}
                {canDemote && prevSibling && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setActiveMenuId(null);
                      if (onReparentTab) {
                        await onReparentTab(node.id, prevSibling.id);
                        setExpandedIds(prev => ({ ...prev, [prevSibling.id]: true }));
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                  >
                    <CornerDownRight className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Thụt lề làm thẻ con</span>
                  </button>
                )}

                {canPromote && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setActiveMenuId(null);
                      if (onReparentTab) {
                        const parent = chapters.find(c => c.id === node.parentId);
                        await onReparentTab(node.id, parent?.parentId || null);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                  >
                    <CornerUpLeft className="w-3.5 h-3.5 text-amber-500" />
                    <span>Nâng lên làm thẻ cha</span>
                  </button>
                )}

                {/* 5. Move Up / Down */}
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

                {/* 6. Delete */}
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

        {/* Render Nested Children with Google Docs-style Indentation Guide Line */}
        {hasChildren && isExpanded && (
          <div className="ml-4 pl-2.5 border-l-2 border-border/70 hover:border-primary/40 transition-colors my-0.5 space-y-0.5">
            {node.children.map((child, idx) =>
              renderTabNode(child, node.children, idx === node.children.length - 1)
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
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/70">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <h2 className="font-semibold text-xs sm:text-sm text-foreground truncate">
            Các thẻ trong tài liệu
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Add Root Tab Button */}
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

      {/* Google Docs Mode Switcher: "Các thẻ" (Document Tabs) vs "Dàn ý" (Document Outline) */}
      <div className="px-2.5 pt-2 pb-1 border-b border-border/40">
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted/60 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveView('tabs')}
            className={`py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 text-[11px] ${
              activeView === 'tabs'
                ? 'bg-card text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>Thẻ ({chapters.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('outline')}
            className={`py-1 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 text-[11px] ${
              activeView === 'outline'
                ? 'bg-card text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListTree className="w-3.5 h-3.5 text-indigo-500" />
            <span>Dàn ý ({effectiveHeadings.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeView === 'tabs' ? (
        /* Tabs Tree List */
        <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
          {tree.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Chưa có thẻ nào. Bấm nút <Plus className="w-3 h-3 inline mx-0.5 text-primary" /> để tạo thẻ đầu tiên.
            </div>
          ) : (
            tree.map((root, idx) => renderTabNode(root, tree, idx === tree.length - 1))
          )}
        </div>
      ) : (
        /* Document Outline for Active Chapter */
        <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground/80 flex items-center justify-between border-b border-border/30 pb-1.5 mb-1.5">
            <span className="truncate">Dàn ý: {activeChapter?.title || 'Thẻ hiện tại'}</span>
            <span className="font-mono text-[10px]">{effectiveHeadings.length} mục</span>
          </div>

          {activeHeadingTree.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground/80 space-y-2">
              <ListTree className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="font-medium text-foreground/80">Chưa có đề mục trong bài</p>
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Định dạng các đoạn văn thành Tiêu đề 1 (H1), Tiêu đề 2 (H2) trong bài viết để xem mục lục dàn ý điều hướng tại đây.
              </p>
            </div>
          ) : (
            activeHeadingTree.map(hNode => renderHeadingNode(hNode))
          )}
        </div>
      )}

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
