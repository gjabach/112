'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Typography from '@tiptap/extension-typography';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, List, ListOrdered, Quote, Heading1, Heading2, Code, Undo, Redo, Strikethrough, Highlighter } from 'lucide-react';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function TiptapEditor({ content, onChange, placeholder = 'Bắt đầu viết...', editable = true }: TiptapEditorProps) {
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
      Highlight
    ],
    content: content ? (() => { try { return JSON.parse(content); } catch { return `<p>${content}</p>`; } })() : '',
    editable,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      onChange(JSON.stringify(json));
    },
    immediatelyRender: false
  });

  useEffect(() => {
    if (editor && content) {
      try {
        const parsed = JSON.parse(content);
        if (JSON.stringify(editor.getJSON()) !== JSON.stringify(parsed)) {
          editor.commands.setContent(parsed);
        }
      } catch {
        // if content is plain text and editor is empty, set it
        if (editor.isEmpty && content) {
          editor.commands.setContent(`<p>${content}</p>`);
        }
      }
    }
  }, [content, editor]);

  if (!editor) return <div className="animate-pulse h-64 bg-muted rounded-lg"></div>;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1.5 border-b bg-card sticky top-0 z-10 overflow-x-auto no-scrollbar flex-nowrap">
        <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Hoàn tác (Ctrl+Z)"><Undo className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Làm lại (Ctrl+Y)"><Redo className="w-4 h-4" /></Button>
        <div className="w-[1px] h-5 bg-border mx-1 shrink-0" />
        <Button variant={editor.isActive('bold') ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleBold().run()} title="In đậm"><Bold className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('italic') ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleItalic().run()} title="In nghiêng"><Italic className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('strike') ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleStrike().run()} title="Gạch ngang"><Strikethrough className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('highlight') ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleHighlight().run()} title="Đánh dấu highlight"><Highlighter className="w-4 h-4" /></Button>
        <div className="w-[1px] h-5 bg-border mx-1 shrink-0" />
        <Button variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Tiêu đề 1"><Heading1 className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Tiêu đề 2"><Heading2 className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Trích dẫn"><Quote className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleBulletList().run()} title="Danh sách"><List className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Danh sách số"><ListOrdered className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shrink-0" onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Khối mã"><Code className="w-4 h-4" /></Button>
        <div className="ml-auto shrink-0 flex items-center gap-2 text-[11px] sm:text-xs text-muted-foreground pl-3 pr-1">
          <span>{editor.storage.characterCount.words()} từ</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">{editor.storage.characterCount.characters()} ký tự</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-12">
        <EditorContent editor={editor} className="max-w-3xl mx-auto prose prose-neutral dark:prose-invert focus:outline-none min-h-[50vh] text-base sm:text-lg" />
      </div>
    </div>
  );
}
