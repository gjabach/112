'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { X, Check } from 'lucide-react';
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
} from './find-replace-extension';
import { toast } from 'sonner';
import { Dialog, DialogTitle } from '@/components/ui/dialog';

interface FindReplaceDialogProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  initialSearch?: string;
}

export function FindReplaceDialog({
  editor,
  isOpen,
  onClose,
  initialSearch = '',
}: FindReplaceDialogProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [ignoreDiacritics, setIgnoreDiacritics] = useState(true);
  const [showRegexHelp, setShowRegexHelp] = useState(false);

  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Refs to avoid circular dependency triggers and maintain current state across events
  const activeIndexRef = useRef(0);
  const matchesRef = useRef<FindMatch[]>([]);
  const isInternalOperationRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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

  // When dialog opens or initial search changes
  useEffect(() => {
    if (isOpen) {
      if (initialSearch) {
        setSearchTerm(initialSearch);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    } else {
      if (editor) {
        clearFindDecorations(editor);
      }
    }
  }, [isOpen, initialSearch, editor]);

  // Run search when search parameters change (searchTerm, options, or dialog open state)
  useEffect(() => {
    if (isOpen && editor) {
      executeSearch();
    }
  }, [executeSearch, isOpen, editor]);

  // Listen for editor updates (e.g. user manually typing, deleting, or editing in the document)
  useEffect(() => {
    if (!editor || !isOpen) return;

    const handleTransaction = ({ transaction }: any) => {
      // Skip if change originated from our own Replace / ReplaceAll button click
      if (isInternalOperationRef.current) return;

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
      onClose();
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
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleReplace();
    }
  };

  if (!isOpen) return null;

  const hasMatches = matches.length > 0;
  const matchIndicator = searchTerm
    ? hasMatches
      ? `${activeIndex + 1}/${matches.length}`
      : '0/0'
    : '';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="max-w-md"
    >
      <div
        ref={dialogRef}
        className="relative w-full rounded-2xl bg-card text-foreground border border-border shadow-2xl p-5 select-none animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5">
          <DialogTitle className="text-2xl font-serif font-medium">
            Tìm và thay thế
          </DialogTitle>
          <button
            onClick={onClose}
            type="button"
            className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent transition-colors focus:outline-none"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
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
              className="w-full bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all pr-16"
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
              className="w-full bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
            />
          </div>
        </div>

        {/* Native controls keep every search option keyboard accessible. */}
        <div className="mt-4 space-y-2 text-sm">
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
            <div className="rounded-lg border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                <code>\\n</code>: xuống dòng · <code>\\t</code>: tab
              </p>
              <p>
                <code>\\d+</code>: chữ số · <code>\\w+</code>: từ
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
        <div className="mt-6 pt-3 flex items-center justify-between border-t border-border flex-wrap gap-1">
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
      </div>
    </Dialog>
  );
}
