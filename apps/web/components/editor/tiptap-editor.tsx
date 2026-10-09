'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import { TextSelection, Selection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Typography from '@tiptap/extension-typography';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Undo,
  Redo,
  Strikethrough,
  Highlighter,
  Search,
} from 'lucide-react';
import { FindAndReplaceExtension } from './find-replace-extension';
import { FindReplaceDialog } from './find-replace-dialog';
import { detectHeadingFromText } from './document-tabs-sidebar';

export interface EditorHeading {
  id: string;
  level: number;
  text: string;
  pos?: number;
}

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  onHeadingsChange?: (headings: EditorHeading[]) => void;
}

function formatPlainTextToHtml(text: string): string {
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\r?\n/)
    .map(
      (line) =>
        `<p>${line ? line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '<br>'}</p>`
    )
    .join('');
}

function extractHeadingsFromEditor(ed: any): EditorHeading[] {
  if (!ed || !ed.state?.doc) return [];
  const list: EditorHeading[] = [];
  const doc = ed.state.doc;
  const blocks: Array<{ node: any; pos: number }> = [];
  doc.forEach((node: any, pos: number) => {
    blocks.push({ node, pos });
  });

  for (let i = 0; i < blocks.length; i++) {
    const { node, pos } = blocks[i];
    if (node.type?.name === 'heading') {
      const level = Number(node.attrs?.level) || 1;
      let text = node.textContent?.trim() || '';
      if (
        text &&
        /^(Chương|Phần|Hồi|Quyển|Tập|Act|Chapter|Part)\s*([0-9IVXLCDM]+|[A-Z])[:.\-]?$/iu.test(
          text
        )
      ) {
        const next = blocks[i + 1]?.node;
        if (next && next.type?.name === 'paragraph') {
          const nextText = next.textContent?.trim() || '';
          if (
            nextText &&
            nextText.length < 120 &&
            !detectHeadingFromText(nextText)
          ) {
            text = `${text} ${nextText}`;
          }
        }
      }
      if (text) {
        list.push({
          id: `heading-${pos}`,
          level,
          text,
          pos,
        });
      }
    } else if (node.type?.name === 'paragraph') {
      const text = node.textContent?.trim() || '';
      if (text) {
        const detected = detectHeadingFromText(text);
        if (detected) {
          let combinedText = detected.text;
          if (
            /^(Chương|Phần|Hồi|Quyển|Tập|Act|Chapter|Part)\s*([0-9IVXLCDM]+|[A-Z])[:.\-]?$/iu.test(
              combinedText
            )
          ) {
            const next = blocks[i + 1]?.node;
            if (next && next.type?.name === 'paragraph') {
              const nextText = next.textContent?.trim() || '';
              if (
                nextText &&
                nextText.length < 120 &&
                !detectHeadingFromText(nextText)
              ) {
                combinedText = `${combinedText} ${nextText}`;
              }
            }
          }
          list.push({
            id: `detected-${pos}`,
            level: detected.level,
            text: combinedText,
            pos,
          });
        }
      }
    }
  }
  return list;
}

export function TiptapEditor({
  content,
  onChange,
  placeholder = 'Bắt đầu viết...',
  editable = true,
  onHeadingsChange,
}: TiptapEditorProps) {
  const lastEmittedContentRef = useRef<string | null>(null);
  const lastUserTypingTimeRef = useRef<number>(0);
  const isApplyingRemoteUpdateRef = useRef<boolean>(false);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');

  const initialContent = (() => {
    if (!content) return '';
    if (typeof content === 'object') return content;
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') return parsed;
      return formatPlainTextToHtml(content);
    } catch {
      return formatPlainTextToHtml(content);
    }
  })();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      Typography,
      Link.configure({ openOnClick: false }),
      Image,
      Highlight,
      FindAndReplaceExtension,
    ],
    content: initialContent,
    editable,
    onUpdate: ({ editor }) => {
      if (isApplyingRemoteUpdateRef.current) return;
      try {
        const json = editor.getJSON();
        const jsonStr = JSON.stringify(json);
        lastEmittedContentRef.current = jsonStr;
        lastUserTypingTimeRef.current = Date.now();
        onChange(jsonStr);
        if (onHeadingsChange) {
          onHeadingsChange(extractHeadingsFromEditor(editor));
        }
      } catch {}
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  const openFindReplace = useCallback(() => {
    if (!editor || !editable) return;
    const { from, to, empty } = editor.state.selection;
    if (!empty && from < to) {
      const selectedText = editor.state.doc.textBetween(from, to, ' ');
      if (
        selectedText &&
        selectedText.trim().length > 0 &&
        selectedText.length < 150
      ) {
        setInitialSearchQuery(selectedText.trim());
      }
    }
    setIsFindOpen(true);
  }, [editor, editable]);

  useEffect(() => {
    if (!editable) setIsFindOpen(false);
  }, [editable]);

  // Global Ctrl+F / Cmd+F shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        e.stopPropagation();
        openFindReplace();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    const handleInsertText = (e: Event) => {
      const custom = e as CustomEvent<{ text: string }>;
      if (editor && custom.detail?.text) {
        editor.chain().focus().insertContent(custom.detail.text).run();
      }
    };
    window.addEventListener('novelist-insert-text', handleInsertText);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('novelist-insert-text', handleInsertText);
    };
  }, [editor, openFindReplace]);

  useEffect(() => {
    if (!editor || content === undefined || content === null) return;
    // Skip if content matches what this editor instance just emitted to avoid circular re-renders
    if (content === lastEmittedContentRef.current) return;

    try {
      const parsed =
        typeof content === 'object'
          ? content
          : content
            ? JSON.parse(content)
            : '';
      const incomingJsonStr =
        typeof content === 'string' ? content : JSON.stringify(content);

      // Deep compare current editor JSON to avoid unnecessary re-renders if document is identical
      const currentJsonStr = JSON.stringify(editor.getJSON());
      if (currentJsonStr === incomingJsonStr) {
        lastEmittedContentRef.current = incomingJsonStr;
        return;
      }

      // Preserve selection and focus state to avoid cursor jumping to top
      const { from, to } = editor.state.selection;
      const wasFocused = editor.isFocused;

      try {
        isApplyingRemoteUpdateRef.current = true;
        editor.commands.setContent(parsed, false);
      } finally {
        isApplyingRemoteUpdateRef.current = false;
      }
      lastEmittedContentRef.current = incomingJsonStr;

      // Restore selection to closest valid position in new document
      const docSize = editor.state.doc.content.size;
      const targetFrom = Math.max(0, Math.min(from, docSize));
      const targetTo = Math.max(targetFrom, Math.min(to, docSize));

      try {
        if (targetFrom > 0 && targetTo > targetFrom) {
          const $from = editor.state.doc.resolve(targetFrom);
          const $to = editor.state.doc.resolve(targetTo);
          const sel = TextSelection.between($from, $to);
          editor.view.dispatch(editor.state.tr.setSelection(sel));
        } else {
          const $pos = editor.state.doc.resolve(targetFrom);
          const sel = Selection.near($pos);
          editor.view.dispatch(editor.state.tr.setSelection(sel));
        }
        if (wasFocused) {
          editor.view.focus();
        }
      } catch {
        try {
          const sel = Selection.atStart(editor.state.doc);
          editor.view.dispatch(editor.state.tr.setSelection(sel));
          if (wasFocused) editor.view.focus();
        } catch {}
      }
    } catch {
      if (editor.isEmpty && content) {
        editor.commands.setContent(formatPlainTextToHtml(content), false);
        lastEmittedContentRef.current = content;
      }
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor && onHeadingsChange) {
      onHeadingsChange(extractHeadingsFromEditor(editor));
    }
  }, [editor, onHeadingsChange]);

  // Jump to heading from Document Tabs sidebar
  useEffect(() => {
    const handleJumpHeading = (e: Event) => {
      const custom = e as CustomEvent<{
        pos?: number;
        text?: string;
        index?: number;
        id?: string;
      }>;
      if (!editor) return;
      const { pos, text, index } = custom.detail || {};

      let targetPos = -1;

      // Find matching heading/paragraph candidates
      if (text) {
        const candidates: number[] = [];
        editor.state.doc.descendants((node: any, p: number) => {
          if (
            (node.type?.name === 'heading' ||
              node.type?.name === 'paragraph') &&
            node.textContent?.trim() === text.trim()
          ) {
            candidates.push(p);
          }
        });

        if (candidates.length > 0) {
          if (
            typeof index === 'number' &&
            index >= 0 &&
            index < candidates.length
          ) {
            targetPos = candidates[index];
          } else if (typeof pos === 'number' && pos >= 0) {
            // Pick candidate closest to given pos
            let closest = candidates[0];
            for (const cPos of candidates) {
              if (Math.abs(cPos - pos) < Math.abs(closest - pos)) {
                closest = cPos;
              }
            }
            targetPos = closest;
          } else {
            targetPos = candidates[0];
          }
        }
      }

      // Fallback to direct position if candidates not found or text not provided
      if (
        targetPos < 0 &&
        typeof pos === 'number' &&
        pos >= 0 &&
        pos < editor.state.doc.content.size
      ) {
        targetPos = pos;
      }

      if (targetPos >= 0) {
        try {
          editor
            .chain()
            .focus()
            .setTextSelection(targetPos + 1)
            .scrollIntoView()
            .run();
          const domNode = editor.view.nodeDOM(targetPos);
          const el =
            domNode instanceof HTMLElement
              ? domNode
              : domNode?.parentElement instanceof HTMLElement
                ? domNode.parentElement
                : null;

          if (el) {
            el.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                .matches
                ? 'instant'
                : 'smooth',
              block: 'center',
            });
            el.classList.add(
              'bg-primary/20',
              'rounded-md',
              'transition-all',
              'duration-500'
            );
            setTimeout(() => {
              el.classList.remove('bg-primary/20');
            }, 1200);
          }
        } catch (err) {
          console.error('Lỗi cuộn tới tiêu đề:', err);
        }
      }
    };

    window.addEventListener('novelist-jump-heading', handleJumpHeading);
    return () => {
      window.removeEventListener('novelist-jump-heading', handleJumpHeading);
    };
  }, [editor]);

  // BUG 1 FIX: When a user selects text (either within a paragraph or across blocks) and clicks H1/H2/H3,
  // TipTap's default toggleHeading calls ProseMirror's setBlockType on the whole enclosing paragraph,
  // causing any text BEFORE (or after) the selection in the same block to also become enlarged.
  // This helper splits the block before/after the selection so ONLY the highlighted text becomes a heading.
  const toggleHeadingSafe = useCallback(
    (level: 1 | 2 | 3) => {
      if (!editor) return;
      const { from, to, empty } = editor.state.selection;

      // If cursor is collapsed (no text selected), use default toggleHeading
      if (empty || from >= to) {
        editor.chain().focus().toggleHeading({ level }).run();
        return;
      }

      const { tr } = editor.state;
      const resFrom = tr.doc.resolve(from);
      const resTo = tr.doc.resolve(to);

      const blockStart = resFrom.start(resFrom.depth);
      const blockEnd = resTo.end(resTo.depth);

      const hasContentBefore = from > blockStart;
      const hasContentAfter = to < blockEnd;

      // If the selection covers the entire block from boundary to boundary, standard toggle is fine
      if (
        !hasContentBefore &&
        !hasContentAfter &&
        resFrom.depth === resTo.depth
      ) {
        editor.chain().focus().toggleHeading({ level }).run();
        return;
      }

      try {
        let currentTr = tr;
        if (hasContentBefore) {
          currentTr = currentTr.split(from);
        }
        const mappedTo = currentTr.mapping.map(to, -1);
        const resMappedTo = currentTr.doc.resolve(mappedTo);
        if (mappedTo < resMappedTo.end(resMappedTo.depth)) {
          currentTr = currentTr.split(mappedTo);
        }

        const targetStart = currentTr.mapping.map(from, 1);
        const targetEnd = currentTr.mapping.map(to, -1);
        const headingType = editor.schema.nodes.heading;
        const paragraphType = editor.schema.nodes.paragraph;

        if (headingType && paragraphType) {
          const resTarget = currentTr.doc.resolve(targetStart);
          const isCurrentHeading =
            resTarget.parent.type === headingType &&
            resTarget.parent.attrs.level === level;
          currentTr.setBlockType(
            targetStart,
            targetEnd,
            isCurrentHeading ? paragraphType : headingType,
            { level }
          );
          currentTr.setSelection(
            TextSelection.create(currentTr.doc, targetStart, targetEnd)
          );
          editor.view.dispatch(currentTr);
          editor.view.focus();
          return;
        }
      } catch {
        // Fallback if split fails on complex block structure
      }

      editor.chain().focus().toggleHeading({ level }).run();
    },
    [editor]
  );

  if (!editor)
    return <div className="animate-pulse h-64 bg-muted rounded-lg"></div>;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden relative">
      {/* Docked Formatting Toolbar */}
      <div
        className={`studio-editor-toolbar shrink-0 border-b bg-card px-2 sm:px-3 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar flex-nowrap z-10 shadow-xs ${!editable ? 'opacity-60 pointer-events-none' : ''}`}
        aria-disabled={!editable}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 shrink-0"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can?.()?.undo?.()}
          title="Hoàn tác (Ctrl+Z)"
        >
          <Undo className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 shrink-0"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can?.()?.redo?.()}
          title="Làm lại (Ctrl+Y)"
        >
          <Redo className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={isFindOpen ? 'secondary' : 'ghost'}
          size="sm"
          className={`h-7 px-2 shrink-0 ${isFindOpen ? 'bg-primary/20 text-primary' : ''}`}
          onClick={openFindReplace}
          title="Tìm và thay thế (Ctrl+F)"
        >
          <Search className="w-3.5 h-3.5" />
        </Button>
        <div className="w-[1px] h-4 bg-border mx-1 shrink-0" />
        <Button
          variant={editor.isActive?.('bold') ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 shrink-0"
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="In đậm"
        >
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={editor.isActive?.('italic') ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 shrink-0"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="In nghiêng"
        >
          <Italic className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={editor.isActive?.('strike') ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 shrink-0"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Gạch ngang"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={editor.isActive?.('highlight') ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 shrink-0"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="Đánh dấu highlight"
        >
          <Highlighter className="w-3.5 h-3.5" />
        </Button>
        <div className="w-[1px] h-4 bg-border mx-1 shrink-0" />
        <Button
          variant={
            editor.isActive?.('heading', { level: 1 }) ? 'secondary' : 'ghost'
          }
          size="sm"
          className="h-7 px-2.5 shrink-0 font-bold"
          onClick={() => toggleHeadingSafe(1)}
          title="Tiêu đề 1 (H1)"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={
            editor.isActive?.('heading', { level: 2 }) ? 'secondary' : 'ghost'
          }
          size="sm"
          className="h-7 px-2.5 shrink-0 font-semibold"
          onClick={() => toggleHeadingSafe(2)}
          title="Tiêu đề 2 (H2)"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={
            editor.isActive?.('heading', { level: 3 }) ? 'secondary' : 'ghost'
          }
          size="sm"
          className="h-7 px-2.5 shrink-0"
          onClick={() => toggleHeadingSafe(3)}
          title="Tiêu đề 3 (H3)"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={editor.isActive?.('blockquote') ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 shrink-0"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Trích dẫn"
        >
          <Quote className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={editor.isActive?.('bulletList') ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 shrink-0"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Danh sách"
        >
          <List className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={editor.isActive?.('orderedList') ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 shrink-0"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Danh sách số"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant={editor.isActive?.('codeBlock') ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 shrink-0"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Khối mã"
        >
          <Code className="w-3.5 h-3.5" />
        </Button>
        <div className="ml-auto shrink-0 flex items-center gap-2 text-[11px] sm:text-xs text-muted-foreground pl-3 pr-1">
          <span>{editor.storage?.characterCount?.words?.() ?? 0} từ</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            {editor.storage?.characterCount?.characters?.() ?? 0} ký tự
          </span>
        </div>
      </div>

      {/* Independently Scrollable Manuscript Canvas */}
      <div className="flex-1 overflow-y-auto p-0 md:p-8 min-h-0">
        <EditorContent
          editor={editor}
          className="studio-manuscript mx-auto focus:outline-none min-h-[60vh] text-base sm:text-lg"
        />
      </div>

      {/* Google Docs Style Find & Replace Floating Dialog */}
      <FindReplaceDialog
        editor={editor}
        isOpen={isFindOpen}
        onClose={() => setIsFindOpen(false)}
        initialSearch={initialSearchQuery}
      />
    </div>
  );
}
