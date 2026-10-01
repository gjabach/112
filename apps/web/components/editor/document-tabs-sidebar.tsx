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
  CornerDownRight, 
  CornerUpLeft,
  Link as LinkIcon,
  Smile,
  ListTree,
  AlertCircle
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
  emoji?: string | null;
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

/**
 * Heuristic detector for headings & structural titles in raw text:
 * Automatically detects patterns like:
 * - Roman numerals: "I, aceererf", "II, nrfnerjf", "I. Mở đầu", "III - Cao trào"
 * - Structural keywords: "Chương 1: ...", "Phần I ...", "Hồi 1 ...", "Mục 1 ..."
 * - Hierarchical numbers: "1.1 ...", "1.2 ...", "1, ...", "2, ..."
 * - Alphabetic sections: "A, ...", "B, ...", "A. ..."
 * - Markdown headings: "# ...", "## ..."
 */
export function detectHeadingFromText(rawText: string): { level: number; text: string } | null {
  if (!rawText) return null;
  // Normalize Unicode to NFC to handle decomposed diacritics (e.g. from MacOS or Unikey)
  const normalized = rawText.normalize('NFC');
  // Strip zero-width spaces and other invisible characters that TipTap might insert
  const cleanedText = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  const trimmed = cleanedText.trim();
  if (!trimmed || trimmed.length > 120) return null;

  // 1. Markdown syntax: # ... (level 1), ## ... (level 2), ### ... (level 3)
  const mdMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (mdMatch) {
    return { level: mdMatch[1].length, text: mdMatch[2].trim() };
  }

  // 2. Roman Numerals: I, II, III, IV, V, VI, VII, VIII, IX, X, XI, XII...
  // E.g.: "I, aceererf", "II, nrfnerjf", "I. Khởi đầu", "III - Cao trào", "IV: Kết thúc"
  const romanMatch = trimmed.match(/^([IVXLCDM]+)[.,:\-)]\s*(.*)$/i);
  if (romanMatch) {
    const isUpper = romanMatch[1] === romanMatch[1].toUpperCase();
    return { level: isUpper ? 1 : 2, text: trimmed };
  }

  // 3. Named Structural Titles: Chương, Hồi, Phần, Quyển, Tập, Mục, Tiết, Bài, Cảnh...
  // Added 'iu' flags for unicode case insensitivity (matches PHẦN vs Phần correctly)
  const namedMajorMatch = trimmed.match(/^(Chương|Hồi|Phần|Quyển|Tập|Act|Chapter|Part)\s*([0-9IVXLCDM]+|[A-Z])[.,:\-\s]*(.*)$/iu);
  if (namedMajorMatch) {
    return { level: 1, text: trimmed };
  }

  const namedMinorMatch = trimmed.match(/^(Mục|Tiết|Bài|Cảnh|Scene|Section)\s*([0-9IVXLCDM]+|[A-Z])[.,:\-\s]*(.*)$/iu);
  if (namedMinorMatch) {
    return { level: 2, text: trimmed };
  }

  // 4. Hierarchical Numbers: "1.1 ...", "1.2 ...", "2.1 ..."
  const hierarchicalNumMatch = trimmed.match(/^(\d+\.\d+(\.\d+)?)[.,:\-\s\xA0]\s*(.+)$/);
  if (hierarchicalNumMatch) {
    const dots = (hierarchicalNumMatch[1].match(/\./g) || []).length;
    return { level: Math.min(3, dots + 1), text: trimmed };
  }

  // 5. Numbered Lists/Sections: "1, ...", "1. ...", "1: ...", "1) ..."
  const numMatch = trimmed.match(/^(\d+)[.,:\-)]\s+(.+)$/);
  if (numMatch) {
    return { level: 2, text: trimmed };
  }

  // 6. Alphabetic Sections: "A, ...", "A. ...", "B, ...", "B. ..."
  const alphaMatch = trimmed.match(/^([A-Z])[.,:\-)]\s+(.+)$/);
  if (alphaMatch) {
    return { level: 2, text: trimmed };
  }

  return null;
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
      const getNodeSize = (n: any): number => {
        if (!n) return 0;
        if (n.type === 'text') return (n.text || '').length;
        if (n.type === 'hardBreak' || n.type === 'image') return 1;
        if (Array.isArray(n.content)) {
          return n.content.reduce((acc: number, child: any) => acc + getNodeSize(child), 0) + 2;
        }
        return 2;
      };

      if (Array.isArray(json.content)) {
        let docPos = 0;
        for (const block of json.content) {
          if (block.type === 'heading') {
            const level = Number(block.attrs?.level) || 1;
            const text = (block.content || []).map((c: any) => c.text || '').join('').trim();
            if (text) {
              list.push({
                id: `h-${list.length}-${text.slice(0, 15)}`,
                level,
                text,
                pos: docPos
              });
            }
          } else if (block.type === 'paragraph') {
            const text = (block.content || []).map((c: any) => c.text || '').join('').trim();
            if (text) {
              const detected = detectHeadingFromText(text);
              if (detected) {
                list.push({
                  id: `p-${list.length}-${text.slice(0, 15)}`,
                  level: detected.level,
                  text,
                  pos: docPos
                });
              }
            }
          }
          docPos += getNodeSize(block);
        }
      }
      if (list.length > 0) return list;
    }
  } catch {}

  // HTML fallback
  const tagRegex = /<(h[1-3]|p)[^>]*>(.*?)<\/\1>/gi;
  let match;
  while ((match = tagRegex.exec(rawContent)) !== null) {
    const tag = match[1].toLowerCase();
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (!text) continue;

    if (tag.startsWith('h')) {
      const level = parseInt(tag[1], 10);
      list.push({
        id: `h-${list.length}-${text.slice(0, 15)}`,
        level,
        text
      });
    } else {
      const detected = detectHeadingFromText(text);
      if (detected) {
        list.push({
          id: `p-${list.length}-${text.slice(0, 15)}`,
          level: detected.level,
          text
        });
      }
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
  onJumpToHeading?: (pos?: number, text?: string, index?: number) => void;
  onCreateTab: (title: string, parentId?: string | null) => Promise<string | void>;
  onRenameTab: (chapterId: string, newTitle: string) => Promise<void>;
  onDeleteTab: (chapterId: string) => Promise<void>;
  onDuplicateTab: (chapterId: string) => Promise<void>;
  onMoveTab: (chapterId: string, direction: 'up' | 'down') => Promise<void>;
  onReparentTab?: (chapterId: string, newParentId: string | null) => Promise<void>;
  onUpdateEmoji?: (chapterId: string, emoji: string | null) => Promise<void>;
  hideHeader?: boolean;
  className?: string;
}

export function getSubtreeHeight(node: TabTreeNode): number {
  if (!node.children || node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map(getSubtreeHeight));
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

export const PRESET_EMOJIS = [
  '📄', '📝', '📖', '📑', '🔖', '💡', '✍️', '🔍', 
  '📌', '🎯', '⭐', '🌟', '🚀', '🔥', '☕', '🌲', 
  '🌸', '🍀', '🌊', '🎭', '💬', '👤', '🏰', '⚔️', 
  '🛡️', '💎', '👑', '📦', '🏷️', '🎨', '📜', '🌙', 
  '☀️', '⚡', '🗝️', '🔮'
];

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
  onUpdateEmoji,
  hideHeader = false,
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

  // State for expanded headings in auto-detected subtabs
  const [expandedHeadingIds, setExpandedHeadingIds] = useState<Record<string, boolean>>({});

  // State for inline renaming
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // State for open context menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // State for emoji picker popover
  const [emojiPickerTabId, setEmojiPickerTabId] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [customEmojiInput, setCustomEmojiInput] = useState('');

  // State for tab outline hidden preference (persisted in localStorage)
  const [hiddenOutlineTabs, setHiddenOutlineTabs] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('novelist_tab_outline_hidden');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const toggleOutlineVisibility = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHiddenOutlineTabs(prev => {
      const next = { ...prev, [tabId]: !prev[tabId] };
      try {
        localStorage.setItem('novelist_tab_outline_hidden', JSON.stringify(next));
      } catch {}
      return next;
    });
    setActiveMenuId(null);
  };

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

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutsideEmoji = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setEmojiPickerTabId(null);
      }
    };
    if (emojiPickerTabId) {
      document.addEventListener('mousedown', handleClickOutsideEmoji);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideEmoji);
    };
  }, [emojiPickerTabId]);

  const tree = buildTabTree(chapters);

  const isAtMaxLimit = chapters.length >= 100;
  const isNearLimit = chapters.length >= 90;

  // Active chapter's real-time live heading tree for automatic subtabs (e.g. I, aceererf / II, nrfnerjf)
  const activeChapter = chapters.find(c => c.id === currentChapterId);
  const effectiveHeadings = headings && headings.length > 0
    ? headings
    : extractHeadingsFromContent(activeChapter?.content);
  const activeHeadingTree = buildHeadingTree(effectiveHeadings);

  // Map occurrence index for identical heading titles
  const headingOccurrenceIndexMap = new Map<string, number>();
  const runningHeadingCounts = new Map<string, number>();
  effectiveHeadings.forEach((h) => {
    const seen = runningHeadingCounts.get(h.text) || 0;
    headingOccurrenceIndexMap.set(h.id, seen);
    runningHeadingCounts.set(h.text, seen + 1);
  });

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
    if (editingTabId !== tabId) return;
    const trimmed = editingTitle.trim();
    setEditingTabId(null);
    if (!trimmed) {
      return; // Revert silently on empty input
    }
    const currentTab = chapters.find(c => c.id === tabId);
    if (currentTab && currentTab.title === trimmed) {
      return; // No change
    }
    try {
      await onRenameTab(tabId, trimmed);
      playSuccessSound();
      toast.success('Đã đổi tên thẻ');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi đổi tên thẻ');
    }
  };

  const handleSelectEmoji = async (tabId: string, emoji: string | null) => {
    setEmojiPickerTabId(null);
    try {
      if (onUpdateEmoji) {
        await onUpdateEmoji(tabId, emoji);
        playSuccessSound();
        toast.success(emoji ? 'Đã đổi biểu tượng thẻ' : 'Đã xóa biểu tượng');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật biểu tượng');
    }
  };

  const copyFallback = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        playSuccessSound();
        toast.success('Đã sao chép liên kết tới thẻ');
      } else {
        toast.error('Không thể sao chép liên kết');
      }
    } catch {
      toast.error('Không thể sao chép liên kết');
    }
  };

  const handleCopyLink = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);
    if (typeof window === 'undefined') return;
    const link = `${window.location.origin}/editor/${projectId}/${tabId}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        playSuccessSound();
        toast.success('Đã sao chép liên kết tới thẻ');
      }).catch(() => {
        copyFallback(link);
      });
    } else {
      copyFallback(link);
    }
  };

  // Create root tab
  const handleCreateRootTab = async () => {
    if (isAtMaxLimit) {
      toast.error('Tài liệu đã đạt giới hạn tối đa 100 thẻ');
      return;
    }
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

  // Create subtab under a parent tab
  const handleCreateSubTab = async (parentNode: TabTreeNode, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);

    if (isAtMaxLimit) {
      toast.error('Tài liệu đã đạt giới hạn tối đa 100 thẻ');
      return;
    }

    // Google Docs allows max 3 levels: depth 0 (root) -> depth 1 (subtab) -> depth 2 (sub-subtab)
    if (parentNode.depth >= 2) {
      toast.error('Google Docs giới hạn phân cấp tối đa 3 cấp thẻ');
      return;
    }

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

  // Automatic subtab node renderer for sections written directly in the document (Google Docs style)
  const renderHeadingNode = (hNode: HeadingTreeNode) => {
    const hasChildren = hNode.children && hNode.children.length > 0;
    const isExpanded = expandedHeadingIds[hNode.id] !== false;

    // Detect if this is Roman numeral (I, II, III...), Number (1., 2.), or Structural (Chương, Phần...)
    const normalizedText = hNode.text.normalize('NFC');
    const romanMatch = normalizedText.match(/^([IVXLCDM]+)[.,:\-)]/i);
    const numMatch = normalizedText.match(/^(\d+[.,:\-)])/);
    const structMatch = normalizedText.match(/^(Chương|Hồi|Phần|Quyển|Tập|Mục|Tiết|Bài)/iu);

    const levelBadge = structMatch ? (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 font-mono shrink-0 uppercase">
        {structMatch[1]}
      </span>
    ) : romanMatch ? (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono shrink-0">
        {romanMatch[1].toUpperCase()}
      </span>
    ) : numMatch ? (
      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono shrink-0">
        {numMatch[1]}
      </span>
    ) : hNode.level === 1 ? (
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
            const occIndex = headingOccurrenceIndexMap.get(hNode.id) || 0;
            if (onJumpToHeading) {
              onJumpToHeading(hNode.pos, hNode.text, occIndex);
            } else {
              window.dispatchEvent(new CustomEvent('novelist-jump-heading', { detail: { pos: hNode.pos, text: hNode.text, index: occIndex, id: hNode.id } }));
            }
          }}
          className={`
            flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors
            hover:bg-primary/15 hover:text-primary select-none
            ${textStyle}
          `}
          title={`Nhảy tới thẻ con: ${hNode.text}`}
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

        {/* Nested child subtabs */}
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
    const isFirstChild = siblings[0]?.id === node.id;
    const nodeSubtreeHeight = getSubtreeHeight(node);
    const countSubtreeNodes = (n: TabTreeNode): number => {
      let count = 1;
      if (n.children && n.children.length > 0) {
        for (const child of n.children) {
          count += countSubtreeNodes(child);
        }
      }
      return count;
    };
    const subtreeNodeCount = countSubtreeNodes(node);
    const canHaveSubtab = node.depth < 2 && !isAtMaxLimit; // Google Docs allows max 3 levels (0, 1, 2)
    const prevSibling = findPreviousSibling(node, siblings);
    const canDemote = Boolean(prevSibling && (prevSibling.depth + 1 + nodeSubtreeHeight <= 2) && onReparentTab);
    const canPromote = Boolean(node.parentId && onReparentTab);
    const isOutlineHidden = Boolean(hiddenOutlineTabs[node.id]);
    const canDelete = chapters.length > subtreeNodeCount;
    const canDuplicate = !isAtMaxLimit && (chapters.length + subtreeNodeCount <= 100);

    return (
      <div key={node.id} className="relative group/tab flex flex-col">
        {/* Tab Row Container */}
        <div
          onClick={() => {
            if (!isEditing) {
              onSelectTab(node.id);
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleStartRename(node, e);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActiveMenuId(activeMenuId === node.id ? null : node.id);
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

          {/* Document Tab Emoji / Icon */}
          <div className="relative shrink-0 flex items-center">
            {node.emoji ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEmojiPickerTabId(emojiPickerTabId === node.id ? null : node.id);
                }}
                className="text-sm shrink-0 hover:scale-115 transition-transform p-0.5 leading-none"
                title="Đổi biểu tượng cảm xúc"
              >
                {node.emoji}
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEmojiPickerTabId(emojiPickerTabId === node.id ? null : node.id);
                }}
                className={`p-0.5 rounded hover:bg-muted/80 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                title="Thêm biểu tượng cảm xúc"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}

            {/* Emoji Picker Popover */}
            {emojiPickerTabId === node.id && (
              <div
                ref={emojiPickerRef}
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-1.5 w-60 bg-card border border-border/80 rounded-xl shadow-2xl p-2.5 z-50 text-xs animate-in fade-in-50 zoom-in-95"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-border/60 mb-2">
                  <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-primary" />
                    Biểu tượng thẻ
                  </span>
                  {node.emoji && (
                    <button
                      type="button"
                      onClick={() => handleSelectEmoji(node.id, null)}
                      className="text-[10px] text-destructive hover:underline font-medium"
                    >
                      Xóa biểu tượng
                    </button>
                  )}
                </div>

                {/* Popular Emojis Grid */}
                <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto no-scrollbar p-0.5">
                  {PRESET_EMOJIS.map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => handleSelectEmoji(node.id, em)}
                      className={`h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent hover:scale-115 transition-transform text-sm ${node.emoji === em ? 'bg-primary/20 ring-1 ring-primary' : ''}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>

                {/* Custom input */}
                <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-1">
                  <Input
                    placeholder="Dán emoji..."
                    value={customEmojiInput}
                    onChange={(e) => setCustomEmojiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customEmojiInput.trim()) {
                        e.preventDefault();
                        handleSelectEmoji(node.id, customEmojiInput.trim());
                        setCustomEmojiInput('');
                      }
                    }}
                    className="h-6 text-xs px-2 py-0.5 flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => {
                      if (customEmojiInput.trim()) {
                        handleSelectEmoji(node.id, customEmojiInput.trim());
                        setCustomEmojiInput('');
                      }
                    }}
                  >
                    Lưu
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Title or inline edit input */}
          {isEditing ? (
            <div 
              className="flex-1 flex items-center gap-1 min-w-0" 
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => handleSaveRename(node.id)}
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSaveRename(node.id)}
                className="p-0.5 text-emerald-500 hover:text-emerald-600 rounded"
                title="Lưu (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
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
                {/* 1. Add Subtab */}
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
                    {node.depth >= 2 ? 'Đã đạt tối đa 3 cấp thẻ' : 'Đã đạt giới hạn 100 thẻ'}
                  </div>
                )}

                {/* 2. Rename */}
                <button
                  type="button"
                  onClick={(e) => handleStartRename(node, e)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Đổi tên thẻ (nhấp đúp)</span>
                </button>

                {/* 3. Change emoji */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    setEmojiPickerTabId(node.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                >
                  <Smile className="w-3.5 h-3.5 text-amber-500" />
                  <span>Đổi biểu tượng cảm xúc</span>
                </button>

                {/* 4. Duplicate */}
                <button
                  type="button"
                  disabled={!canDuplicate}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    if (!canDuplicate) {
                      toast.error('Tài liệu đã đạt giới hạn tối đa 100 thẻ');
                      return;
                    }
                    await onDuplicateTab(node.id);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left ${
                    !canDuplicate ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Nhân bản thẻ</span>
                </button>

                {/* 5. Copy Link to Tab */}
                <button
                  type="button"
                  onClick={(e) => handleCopyLink(node.id, e)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-sky-500" />
                  <span>Sao chép liên kết tới thẻ</span>
                </button>

                <div className="my-1 border-t border-border/50" />

                {/* 6. Demote / Promote (Reparenting) */}
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

                {/* 7. Move Up / Down */}
                <button
                  type="button"
                  disabled={isFirstChild}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (isFirstChild) return;
                    setActiveMenuId(null);
                    await onMoveTab(node.id, 'up');
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-foreground transition-colors text-left ${
                    isFirstChild ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent'
                  }`}
                >
                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Chuyển lên trên</span>
                </button>
                <button
                  type="button"
                  disabled={isLastChild}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (isLastChild) return;
                    setActiveMenuId(null);
                    await onMoveTab(node.id, 'down');
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-foreground transition-colors text-left ${
                    isLastChild ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent'
                  }`}
                >
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Chuyển xuống dưới</span>
                </button>

                <div className="my-1 border-t border-border/50" />

                {/* 8. Toggle Outline */}
                <button
                  type="button"
                  onClick={(e) => toggleOutlineVisibility(node.id, e)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground transition-colors text-left"
                >
                  <ListTree className="w-3.5 h-3.5 text-violet-500" />
                  <span>{isOutlineHidden ? 'Hiện dàn ý tài liệu' : 'Ẩn dàn ý tài liệu'}</span>
                </button>

                <div className="my-1 border-t border-border/50" />

                {/* 9. Delete */}
                <button
                  type="button"
                  disabled={!canDelete}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setActiveMenuId(null);
                    if (!canDelete) {
                      toast.error('Tài liệu phải có tối thiểu 1 thẻ');
                      return;
                    }
                    const promptMsg = hasChildren 
                      ? `Xóa thẻ "${node.title}" và toàn bộ ${subtreeNodeCount - 1} thẻ con trực thuộc?`
                      : `Xóa thẻ "${node.title}"?`;
                    if (confirm(promptMsg)) {
                      await onDeleteTab(node.id);
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left font-medium ${
                    !canDelete 
                      ? 'opacity-40 cursor-not-allowed text-muted-foreground' 
                      : 'hover:bg-destructive/10 text-destructive'
                  }`}
                  title={!canDelete ? 'Tài liệu phải có tối thiểu 1 thẻ' : undefined}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa thẻ</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Real-time automatic subtabs under active document (Google Docs style: e.g. I, aceererf / II, nrfnerjf) */}
        {isActive && activeHeadingTree.length > 0 && !isOutlineHidden && (
          <div className="ml-4 pl-2.5 border-l-2 border-primary/40 space-y-0.5 my-1 animate-in fade-in duration-150">
            {activeHeadingTree.map(hNode => renderHeadingNode(hNode))}
          </div>
        )}

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
      {!hideHeader && (
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-border/70">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <h2 className="font-semibold text-xs sm:text-sm text-foreground truncate">
              Các thẻ trong tài liệu
            </h2>
            {isNearLimit && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                isAtMaxLimit ? 'bg-destructive/20 text-destructive' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              }`} title={isAtMaxLimit ? 'Đã đạt giới hạn tối đa 100 thẻ' : 'Sắp đạt giới hạn 100 thẻ'}>
                {chapters.length}/100
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Add Root Tab Button */}
            <Button
              size="icon"
              variant="ghost"
              disabled={isAtMaxLimit}
              className={`h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors ${
                isAtMaxLimit ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              onClick={handleCreateRootTab}
              title={isAtMaxLimit ? 'Tài liệu đã đạt giới hạn tối đa 100 thẻ' : 'Thêm thẻ mới (+)'}
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
      )}

      {/* Tabs Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
        {tree.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Chưa có thẻ nào. Bấm nút <Plus className="w-3 h-3 inline mx-0.5 text-primary" /> để tạo thẻ đầu tiên.
          </div>
        ) : (
          tree.map((root, idx) => renderTabNode(root, tree, idx === tree.length - 1))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-1.5">
          <span>{chapters.length} thẻ tài liệu</span>
          {isNearLimit && (
            <span className={`text-[10px] font-mono font-semibold ${isAtMaxLimit ? 'text-destructive font-bold' : 'text-amber-500'}`}>
              ({chapters.length}/100)
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={isAtMaxLimit}
          onClick={handleCreateRootTab}
          className={`text-primary hover:underline font-medium flex items-center gap-1 text-[11px] ${
            isAtMaxLimit ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          title={isAtMaxLimit ? 'Đã đạt tối đa 100 thẻ' : undefined}
        >
          <Plus className="w-3 h-3" />
          <span>Thêm thẻ</span>
        </button>
      </div>
    </aside>
  );
}
