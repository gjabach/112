'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { X, Check } from 'lucide-react';
import {
  FindMatch,
  FindOptions,
  findMatchesInDoc,
  processReplacementText
} from '@/lib/find-replace';
import {
  clearFindDecorations,
  goToMatch
} from './find-replace-extension';
import { toast } from 'sonner';

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
  initialSearch = ''
}: FindReplaceDialogProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [ignoreDiacritics, setIgnoreDiacritics] = useState(true);
  const [showRegexHelp, setShowRegexHelp] = useState(false);

  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Refs to avoid circular dependency triggers during next/prev cycling
  const activeIndexRef = useRef(0);
  const matchesRef = useRef<FindMatch[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Core search execution function
  const executeSearch = useCallback(
    (targetDoc?: any, preserveIndex = false) => {
      if (!editor || !isOpen) return;

      const doc = targetDoc || editor.state.doc;
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
        ignoreDiacritics
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

      const targetIdx = preserveIndex
        ? Math.min(activeIndexRef.current, found.length - 1)
        : 0;

      activeIndexRef.current = targetIdx;
      setActiveIndex(targetIdx);
      goToMatch(editor, found, targetIdx);
    },
    [editor, isOpen, searchTerm, caseSensitive, useRegex, ignoreDiacritics]
  );

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

  // Run search only when search parameters change (searchTerm, options, or dialog open state)
  useEffect(() => {
    if (isOpen && editor) {
      executeSearch();
    }
  }, [executeSearch, isOpen, editor]);

  // Listen for editor updates (e.g. typing or undo) while dialog is open
  useEffect(() => {
    if (!editor || !isOpen) return;

    const handleTransaction = ({ transaction }: any) => {
      if (transaction.docChanged) {
        executeSearch(transaction.doc, true);
      }
    };

    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor, isOpen, executeSearch]);

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

    const prev = (activeIndexRef.current - 1 + curMatches.length) % curMatches.length;
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

    const tr = editor.state.tr.insertText(replacement, active.from, active.to);
    editor.view.dispatch(tr);
  }, [editor, replaceTerm, useRegex, caseSensitive, searchTerm]);

  // Replace all matches in one atomic transaction
  const handleReplaceAll = useCallback(() => {
    const curMatches = matchesRef.current;
    if (curMatches.length === 0 || !editor) return;

    const count = curMatches.length;
    const textToInsert = processReplacementText(replaceTerm, useRegex);
    const tr = editor.state.tr;

    // Iterate backwards from highest doc position to lowest to prevent index shifting
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
    toast.success(`Đã thay thế ${count} kết quả`);
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
    <div
      ref={dialogRef}
      className="fixed top-14 sm:top-16 right-2 sm:right-6 z-50 w-[95vw] max-w-[390px] sm:max-w-[420px] rounded-2xl bg-[#282a2d] text-neutral-100 border border-neutral-700/80 shadow-2xl p-5 select-none animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
      role="dialog"
      aria-label="Tìm và thay thế"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5">
        <h2 className="text-[19px] font-medium tracking-tight text-white">
          Tìm và thay thế
        </h2>
        <button
          onClick={onClose}
          type="button"
          className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors focus:outline-none"
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
            placeholder="Tìm"
            className="w-full bg-[#1e1f21] border border-neutral-600/80 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none transition-all pr-16"
          />
          {matchIndicator && (
            <span
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-medium ${
                hasMatches ? 'text-blue-400' : 'text-neutral-400'
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
            placeholder="Thay thế bằng"
            className="w-full bg-[#1e1f21] border border-neutral-600/80 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none transition-all"
          />
        </div>
      </div>

      {/* Options Checkboxes */}
      <div className="mt-4 space-y-2.5">
        {/* Match Case */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-all ${
              caseSensitive
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-neutral-500 bg-transparent group-hover:border-neutral-400'
            }`}
          >
            {caseSensitive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
          <span className="text-[13px] text-neutral-200 group-hover:text-white transition-colors">
            Khớp chữ hoa chữ thường
          </span>
        </label>

        {/* Use Regular Expressions */}
        <div>
          <div className="flex items-center justify-between">
            <label className="flex items-start gap-3 cursor-pointer group flex-1">
              <div
                onClick={() => setUseRegex(!useRegex)}
                className={`w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                  useRegex
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-neutral-500 bg-transparent group-hover:border-neutral-400'
                }`}
              >
                {useRegex && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <span className="text-[13px] text-neutral-200 leading-snug group-hover:text-white transition-colors">
                Sử dụng biểu thức chính quy (ví dụ: \n cho dòng mới, \t cho ký tự tab){' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowRegexHelp(!showRegexHelp);
                  }}
                  className="text-blue-400 hover:text-blue-300 underline font-normal ml-0.5"
                >
                  Trợ giúp
                </button>
              </span>
            </label>
          </div>

          {/* Regex quick helper popup */}
          {showRegexHelp && (
            <div className="mt-2 p-2.5 rounded-lg bg-[#1e1f21] border border-neutral-700 text-xs text-neutral-300 space-y-1 animate-in fade-in duration-150">
              <div className="font-semibold text-blue-400 mb-1">Mẹo Regular Expressions:</div>
              <div><code className="text-white bg-black/40 px-1 rounded">\n</code> : Xuống dòng</div>
              <div><code className="text-white bg-black/40 px-1 rounded">\t</code> : Ký tự Tab</div>
              <div><code className="text-white bg-black/40 px-1 rounded">\d+</code> : Tìm một hoặc nhiều chữ số</div>
              <div><code className="text-white bg-black/40 px-1 rounded">\w+</code> : Tìm từ chữ cái</div>
              <div><code className="text-white bg-black/40 px-1 rounded">^ / $</code> : Khớp đầu dòng / cuối dòng</div>
            </div>
          )}
        </div>

        {/* Ignore Diacritics */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            onClick={() => setIgnoreDiacritics(!ignoreDiacritics)}
            className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-all ${
              ignoreDiacritics
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-neutral-500 bg-transparent group-hover:border-neutral-400'
            }`}
          >
            {ignoreDiacritics && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
          <span className="text-[13px] text-neutral-200 group-hover:text-white transition-colors">
            Bỏ qua các dấu (ví dụ: ā = a, E = É, א = א)
          </span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 pt-3 flex items-center justify-between border-t border-neutral-700/60 flex-wrap gap-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleReplace}
          disabled={!hasMatches}
          className="text-xs sm:text-[13px] font-medium px-2 sm:px-2.5 py-1.5 rounded transition-colors text-blue-400 hover:text-blue-300 hover:bg-white/5 disabled:text-neutral-500 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          Thay thế
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleReplaceAll}
          disabled={!hasMatches}
          className="text-xs sm:text-[13px] font-medium px-2 sm:px-2.5 py-1.5 rounded transition-colors text-blue-400 hover:text-blue-300 hover:bg-white/5 disabled:text-neutral-500 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          Thay thế tất cả
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handlePrev}
          disabled={!hasMatches}
          className="text-xs sm:text-[13px] font-medium px-2 sm:px-2.5 py-1.5 rounded transition-colors text-blue-400 hover:text-blue-300 hover:bg-white/5 disabled:text-neutral-500 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          Trước
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleNext}
          disabled={!hasMatches}
          className="text-xs sm:text-[13px] font-medium px-2 sm:px-2.5 py-1.5 rounded transition-colors text-blue-400 hover:text-blue-300 hover:bg-white/5 disabled:text-neutral-500 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          Tiếp
        </button>
      </div>
    </div>
  );
}
