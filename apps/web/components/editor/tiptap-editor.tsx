'use client';
import { useEditor, EditorContent } from '@tiptap/react';
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
  Code,
  Undo,
  Redo,
  Strikethrough,
  Highlighter,
  Search
} from 'lucide-react';
import { FindAndReplaceExtension } from './find-replace-extension';
import { FindReplaceDialog } from './find-replace-dialog';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function TiptapEditor({ content, onChange, placeholder = 'Bắt đầu viết...', editable = true }: TiptapEditorProps) {
  const lastEmittedContentRef = useRef<string | null>(null);
  const lastUserTypingTimeRef = useRef<number>(0);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');

  const initialContent = (() => {
    if (!content) return '';
    if (typeof content === 'object') return content;
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') return parsed;
      return `<p>${content}</p>`;
    } catch {
      return `<p>${content}</p>`;
    }
  })();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      Typography,
      Link.configure({ openOnClick: false }),
      Image,
      Highlight,
      FindAndReplaceExtension
    ],
    content: initialContent,
    editable,
    onUpdate: ({ editor }) => {
      try {
        const json = editor.getJSON();
        const jsonStr = JSON.stringify(json);
        lastEmittedContentRef.current = jsonStr;
        lastUserTypingTimeRef.current = Date.now();
        onChange(jsonStr);
      } catch {}
    },
    immediatelyRender: false
  });

  const openFindReplace = useCallback(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (!empty && from < to) {
      const selectedText = editor.state.doc.textBetween(from, to, ' ');
      if (selectedText && selectedText.trim().length > 0 && selectedText.length < 150) {
        setInitialSearchQuery(selectedText.trim());
      }
    }
    setIsFindOpen(true);
  }, [editor]);

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
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [openFindReplace]);

  useEffect(() => {
    if (!editor || !content) return;
    // Skip if content matches what this editor instance just emitted to avoid circular re-renders
    if (content === lastEmittedContentRef.current) return;

    // Guard: If user was actively typing on this device within the last 1500ms, do not clobber active keystrokes
    if (Date.now() - lastUserTypingTimeRef.current < 1500) {
      return;
    }

    try {
      const parsed = typeof content === 'object' ? content : JSON.parse(content);
      editor.commands.setContent(parsed);
      lastEmittedContentRef.current = typeof content === 'string' ? content : JSON.stringify(content);
    } catch {
      if (editor.isEmpty && content) {
        editor.commands.setContent(`<p>${content}</p>`);
      }
    }
  }, [content, editor]);

  if (!editor) return <div className="animate-pulse h-64 bg-muted rounded-lg"></div>;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden relative">
      {/* Docked Formatting Toolbar */}
      <div className="shrink-0 border-b bg-card/95 backdrop-blur-sm px-2 sm:px-3 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar flex-nowrap z-10 shadow-xs">
        <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can?.()?.undo?.()} title="Hoàn tác (Ctrl+Z)"><Undo className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can?.()?.redo?.()} title="Làm lại (Ctrl+Y)"><Redo className="w-3.5 h-3.5" /></Button>
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
        <Button variant={editor.isActive?.('bold') ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleBold().run()} title="In đậm"><Bold className="w-3.5 h-3.5" /></Button>
        <Button variant={editor.isActive?.('italic') ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleItalic().run()} title="In nghiêng"><Italic className="w-3.5 h-3.5" /></Button>
        <Button variant={editor.isActive?.('strike') ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleStrike().run()} title="Gạch ngang"><Strikethrough className="w-3.5 h-3.5" /></Button>
        <Button variant={editor.isActive?.('highlight') ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleHighlight().run()} title="Đánh dấu highlight"><Highlighter className="w-3.5 h-3.5" /></Button>
        <div className="w-[1px] h-4 bg-border mx-1 shrink-0" />
        <Button variant={editor.isActive?.('heading', { level: 1 }) ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Tiêu đề 1"><Heading1 className="w-3.5 h-3.5" /></Button>
        <Button variant={editor.isActive?.('heading', { level: 2 }) ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Tiêu đề 2"><Heading2 className="w-3.5 h-3.5" /></Button>
        <Button variant={editor.isActive?.('blockquote') ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Trích dẫn"><Quote className="w-3.5 h-3.5" /></Button>
        <Button variant={editor.isActive?.('bulletList') ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleBulletList().run()} title="Danh sách"><List className="w-3.5 h-3.5" /></Button>
        <Button variant={editor.isActive?.('orderedList') ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Danh sách số"><ListOrdered className="w-3.5 h-3.5" /></Button>
        <Button variant={editor.isActive?.('codeBlock') ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Khối mã"><Code className="w-3.5 h-3.5" /></Button>
        <div className="ml-auto shrink-0 flex items-center gap-2 text-[11px] sm:text-xs text-muted-foreground pl-3 pr-1">
          <span>{editor.storage?.characterCount?.words?.() ?? 0} từ</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">{editor.storage?.characterCount?.characters?.() ?? 0} ký tự</span>
        </div>
      </div>

      {/* Independently Scrollable Manuscript Canvas */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-12 min-h-0">
        <EditorContent editor={editor} className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert focus:outline-none min-h-[60vh] text-base sm:text-lg" />
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
