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
import { Bold, Italic, List, ListOrdered, Quote, Heading1, Heading2, Code, Image as ImageIcon } from 'lucide-react';

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
      <div className="flex flex-wrap gap-1 p-2 border-b bg-card sticky top-0 z-10">
        <Button variant={editor.isActive('bold') ? 'secondary' : 'ghost'} size="sm" onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('italic') ? 'secondary' : 'ghost'} size="sm" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'} size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'} size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'} size="sm" onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Button>
        <Button variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'} size="sm" onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code className="w-4 h-4" /></Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {editor.storage.characterCount.words()} từ • {editor.storage.characterCount.characters()} ký tự
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-12">
        <EditorContent editor={editor} className="max-w-3xl mx-auto prose prose-lg dark:prose-invert focus:outline-none" />
      </div>
    </div>
  );
}
