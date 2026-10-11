'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Editor } from '@tiptap/react';
import { X, GripHorizontal } from 'lucide-react';
import {
  FindMatch,
  FindOptions,
  findMatchesInDoc,
  processReplacementText,
} from '@/lib/find-replace';
import {
  clearFindDecorations,
  updateMatchDecorations,
  goToMatch,
  findAndReplacePluginKey,
} from './find-replace-extension';
import { toast } from 'sonner';

interface FindReplaceDialogProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  initialSearch?: string;
  focusTrigger?: number;
}

export function FindReplaceDialog({
  editor,
  isOpen,
  onClose,
  initialSearch = '',
  focusTrigger = 0,
}: FindReplaceDialogProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [ignoreDiacritics, setIgnoreDiacritics] = useState(true);
  const [showRegexHelp, setShowRegexHelp] = useState(false);

  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Floating position & dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Refs to avoid circular dependency triggers and maintain current state across events
  const activeIndexRef = useRef(0);
  const matchesRef = useRef<FindMatch[]>([]);
  const isInternalOperationRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bounds clamping helper to keep dialog inside viewport
  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };
    const width = dialogRef.current?.offsetWidth || 410;
    const height = dialogRef.current?.offsetHeight || 380;
    const minX = 8;
    const maxX = Math.max(minX, window.innerWidth - width - 8);
    const minY = 8;
    const maxY = Math.max(minY, window.innerHeight - height - 8);
    return {
      x: Math.min(Math.max(minX, x), maxX),
      y: Math.min(Math.max(minY, y), maxY),
    };
  }, []);

  // Initialize or re-clamp position when opened
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    setPosition((prev) => {
      if (prev) {
        return clampPosition(prev.x, prev.y);
      }
      // Default position: top right corner with good margin from top toolbar
      const dialogWidth = Math.min(410, window.innerWidth - 24);
      const defaultX = Math.max(12, window.innerWidth - dialogWidth - 28);
      const defaultY = 76;
      return { x: defaultX, y: defaultY };
    });
  }, [isOpen, clampPosition]);

  // Keep dialog clamped inside window on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        return clampPosition(prev.x, prev.y);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Drag handling via Pointer Events
  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left-click
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a, label')) {
      return;
    }

    e.preventDefault();
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;

    const rect = dialogEl.getBoundingClientRect();
    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    const startPosX = rect.left;
    const startPosY = rect.top;

    setIsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startPointerX;
      const deltaY = moveEvent.clientY - startPointerY;

      const width = dialogEl.offsetWidth;
      const height = dialogEl.offsetHeight;
      const minX = 8;
      const maxX = Math.max(minX, window.innerWidth - width - 8);
      const minY = 8;
      const maxY = Math.max(minY, window.innerHeight - height - 8);

      const nextX = Math.min(Math.max(minX, startPosX + deltaX), maxX);
      const nextY = Math.min(Math.max(minY, startPosY + deltaY), maxY);

      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Close handler that returns focus to editor
  const handleClose = useCallback(() => {
    onClose();
    editor?.commands.focus();
  }, [onClose, editor]);

  // Global Escape key listener when Find & Replace is open
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen, handleClose]);

  // Core search execution when search input or options change
  const executeSearch = useCallback(() => {
    if (!editor || !isOpen) return;

    const doc = editor.state.doc;
    if (!searchTerm) {
      matchesRef.current = [];
      setMatches([]);
      activeIndexRef.current = 0;
      setActiveIndex(0);
      clearFindDecorations(editor);
      return;
    }

    const options: FindOptions = {
      caseSensitive,
      useRegex,
      ignoreDiacritics,
    };

    const found = findMatchesInDoc(doc, searchTerm, options);
    matchesRef.current = found;
    setMatches(found);

    if (found.length === 0) {
      activeIndexRef.current = 0;
      setActiveIndex(0);
      clearFindDecorations(editor);
      return;
    }

    const targetIdx = 0;
    activeIndexRef.current = targetIdx;
    setActiveIndex(targetIdx);
    goToMatch(editor, found, targetIdx);
  }, [editor, isOpen, searchTerm, caseSensitive, useRegex, ignoreDiacritics]);

  // When dialog opens or initial search changes, or focus triggered
  useEffect(() => {
    if (isOpen) {
      if (initialSearch) {
        setSearchTerm(initialSearch);
      }
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      if (editor) {
        clearFindDecorations(editor);
      }
    }
  }, [isOpen, focusTrigger, initialSearch, editor]);

  // Run search when search parameters change (searchTerm, options, or dialog open state)
  useEffect(() => {
    if (isOpen && editor) {
      executeSearch();
    }
  }, [executeSearch, isOpen, editor]);

  // Listen for editor updates (e.g. user manually typing, deleting, or editing in the manuscript)
  useEffect(() => {
    if (!editor || !isOpen) return;

    const handleTransaction = ({ transaction }: any) => {
      // Skip if change originated from our own Replace / ReplaceAll button click or decoration dispatch
      if (isInternalOperationRef.current) return;
      if (transaction.getMeta(findAndReplacePluginKey)) return;

      if (transaction.docChanged) {
        if (!searchTerm) {
          matchesRef.current = [];
          setMatches([]);
          activeIndexRef.current = 0;
          setActiveIndex(0);
          clearFindDecorations(editor);
          return;
        }

        const options: FindOptions = {
          caseSensitive,
          useRegex,
          ignoreDiacritics,
        };

        const found = findMatchesInDoc(transaction.doc, searchTerm, options);
        matchesRef.current = found;
        setMatches(found);

        if (found.length === 0) {
          activeIndexRef.current = 0;
          setActiveIndex(0);
          clearFindDecorations(editor);
          return;
        }

        // Find match closest to user's current caret position, or preserve index
        const caretPos = transaction.selection?.from ?? 0;
        let bestIdx = 0;
        let minDiff = Infinity;
        found.forEach((m, idx) => {
          const diff = Math.abs(m.from - caretPos);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = idx;
          }
        });

        activeIndexRef.current = bestIdx;
        setActiveIndex(bestIdx);

        // Crucial: ONLY update visual decorations! DO NOT set selection, DO NOT scroll!
        // The user's caret stays exactly where they are typing in the manuscript!
        updateMatchDecorations(editor, found, bestIdx);
      } else if (transaction.selectionSet && matchesRef.current.length > 0) {
        // If selection moved (e.g. user clicked on a match in the manuscript),
        // update active index to that match if caret is directly inside it
        const caretPos = transaction.selection?.from ?? 0;
        const curMatches = matchesRef.current;
        const insideIdx = curMatches.findIndex(
          (m) => caretPos >= m.from && caretPos <= m.to
        );
        if (insideIdx !== -1 && insideIdx !== activeIndexRef.current) {
          activeIndexRef.current = insideIdx;
          setActiveIndex(insideIdx);
          updateMatchDecorations(editor, curMatches, insideIdx);
        }
      }
    };

    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor, isOpen, searchTerm, caseSensitive, useRegex, ignoreDiacritics]);

  // Navigate to next match
  const handleNext = useCallback(() => {
    const curMatches = matchesRef.current;
    if (curMatches.length === 0 || !editor) return;

    const next = (activeIndexRef.current + 1) % curMatches.length;
    activeIndexRef.current = next;
    setActiveIndex(next);
    goToMatch(editor, curMatches, next);
  }, [editor]);

  // Navigate to previous match
  const handlePrev = useCallback(() => {
    const curMatches = matchesRef.current;
    if (curMatches.length === 0 || !editor) return;

    const prev =
      (activeIndexRef.current - 1 + curMatches.length) % curMatches.length;
    activeIndexRef.current = prev;
    setActiveIndex(prev);
    goToMatch(editor, curMatches, prev);
  }, [editor]);

  // Replace single active match
  const handleReplace = useCallback(() => {
    const curMatches = matchesRef.current;
    if (curMatches.length === 0 || !editor) return;

    const active = curMatches[activeIndexRef.current];
    if (!active) return;

    const textToInsert = processReplacementText(replaceTerm, useRegex);

    let replacement = textToInsert;
    if (useRegex) {
      try {
        const flags = caseSensitive ? '' : 'i';
        const reg = new RegExp(searchTerm, flags);
        replacement = active.text.replace(reg, textToInsert);
      } catch {}
    }

    isInternalOperationRef.current = true;
    try {
      const tr = editor.state.tr.insertText(
        replacement,
        active.from,
        active.to
      );
      editor.view.dispatch(tr);

      // Re-scan after replacement
      const options: FindOptions = {
        caseSensitive,
        useRegex,
        ignoreDiacritics,
      };
      const newMatches = findMatchesInDoc(
        editor.state.doc,
        searchTerm,
        options
      );
      matchesRef.current = newMatches;
      setMatches(newMatches);

      if (newMatches.length > 0) {
        const nextIdx =
          activeIndexRef.current < newMatches.length
            ? activeIndexRef.current
            : 0;
        activeIndexRef.current = nextIdx;
        setActiveIndex(nextIdx);
        goToMatch(editor, newMatches, nextIdx);
      } else {
        activeIndexRef.current = 0;
        setActiveIndex(0);
        clearFindDecorations(editor);
      }
    } finally {
      isInternalOperationRef.current = false;
    }
  }, [
    editor,
    replaceTerm,
    useRegex,
    caseSensitive,
    searchTerm,
    ignoreDiacritics,
  ]);

  // Replace all matches in one atomic transaction
  const handleReplaceAll = useCallback(() => {
    const curMatches = matchesRef.current;
    if (curMatches.length === 0 || !editor) return;

    const count = curMatches.length;
    const textToInsert = processReplacementText(replaceTerm, useRegex);

    isInternalOperationRef.current = true;
    try {
      const tr = editor.state.tr;
      for (let i = curMatches.length - 1; i >= 0; i--) {
        const m = curMatches[i];
        let replacement = textToInsert;
        if (useRegex) {
          try {
            const flags = caseSensitive ? '' : 'i';
            const reg = new RegExp(searchTerm, flags);
            replacement = m.text.replace(reg, textToInsert);
          } catch {}
        }
        tr.insertText(replacement, m.from, m.to);
      }

      editor.view.dispatch(tr);

      matchesRef.current = [];
      setMatches([]);
      activeIndexRef.current = 0;
      setActiveIndex(0);
      clearFindDecorations(editor);

      toast.success(`Đã thay thế ${count} kết quả`);
    } finally {
      isInternalOperationRef.current = false;
    }
  }, [editor, replaceTerm, useRegex, caseSensitive, searchTerm]);

  // Keyboard navigation inside inputs
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  const handleReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleReplace();
    }
  };

  if (!isOpen || !mounted || !position) return null;

  const hasMatches = matches.length > 0;
  const matchIndicator = searchTerm
    ? hasMatches
      ? `${activeIndex + 1}/${matches.length}`
      : '0/0'
    : '';

  return createPortal(
    <div
      ref={dialogRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: 'min(410px, calc(100vw - 24px))',
        zIndex: 50,
      }}
      className={`rounded-2xl bg-card/95 text-foreground border border-border shadow-2xl p-5 backdrop-blur-md transition-shadow duration-150 select-none ${
        isDragging
          ? 'shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-2 ring-primary/40'
          : 'shadow-xl'
      }`}
      role="dialog"
      aria-label="Tìm và thay thế"
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handleHeaderPointerDown}
        className="flex items-center justify-between pb-3.5 border-b border-border/50 cursor-grab active:cursor-grabbing select-none"
        title="Giữ chuột để di chuyển hộp thoại"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-muted-foreground/60 shrink-0" />
          <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground">
            Tìm và thay thế
          </h2>
        </div>
        <button
          onClick={handleClose}
          type="button"
          className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent transition-colors focus:outline-none"
          title="Đóng (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Inputs */}
      <div className="space-y-3 mt-3">
        {/* Find Input */}
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Tìm trong bản thảo"
            placeholder="Tìm"
            className="w-full bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all pr-16 select-text"
          />
          {matchIndicator && (
            <span
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-medium ${
                hasMatches ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {matchIndicator}
            </span>
          )}
        </div>

        {/* Replace Input */}
        <div>
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            aria-label="Thay thế bằng"
            placeholder="Thay thế bằng"
            className="w-full bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all select-text"
          />
        </div>
      </div>

      {/* Native controls keep every search option keyboard accessible. */}
      <div className="mt-4 space-y-2 text-sm select-none">
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(event) => setCaseSensitive(event.target.checked)}
          />
          Khớp chữ hoa chữ thường
        </label>
        <div className="flex items-center justify-between gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(event) => setUseRegex(event.target.checked)}
            />
            Sử dụng biểu thức chính quy
          </label>
          <button
            type="button"
            aria-expanded={showRegexHelp}
            className="min-h-11 text-xs text-primary underline"
            onClick={() => setShowRegexHelp(!showRegexHelp)}
          >
            Trợ giúp
          </button>
        </div>
        {showRegexHelp && (
          <div className="rounded-lg border bg-muted p-3 text-xs leading-relaxed text-muted-foreground select-text">
            <p>
              <code>\n</code>: xuống dòng · <code>\t</code>: tab
            </p>
            <p>
              <code>\d+</code>: chữ số · <code>\w+</code>: từ
            </p>
            <p>
              <code>^ / $</code>: đầu dòng / cuối dòng
            </p>
          </div>
        )}
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={ignoreDiacritics}
            onChange={(event) => setIgnoreDiacritics(event.target.checked)}
          />
          Bỏ qua dấu (ví dụ: mùa = mua)
        </label>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 pt-3 flex items-center justify-between border-t border-border flex-wrap gap-1 select-none">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleReplace}
          disabled={!hasMatches}
          className="text-xs sm:text-[13px] font-medium px-2 sm:px-2.5 py-1.5 rounded transition-colors text-primary hover:text-primary hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          Thay thế
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleReplaceAll}
          disabled={!hasMatches}
          className="text-xs sm:text-[13px] font-medium px-2 sm:px-2.5 py-1.5 rounded transition-colors text-primary hover:text-primary hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          Thay thế tất cả
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handlePrev}
          disabled={!hasMatches}
          className="text-xs sm:text-[13px] font-medium px-2 sm:px-2.5 py-1.5 rounded transition-colors text-primary hover:text-primary hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          Trước
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleNext}
          disabled={!hasMatches}
          className="text-xs sm:text-[13px] font-medium px-2 sm:px-2.5 py-1.5 rounded transition-colors text-primary hover:text-primary hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          Tiếp
        </button>
      </div>
    </div>,
    document.body
  );
}
