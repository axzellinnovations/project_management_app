'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import debounce from 'lodash.debounce';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Code, Link as LinkIcon, Highlighter,
  List, ListOrdered, CheckSquare,
  Heading1, Heading2, Heading3, Quote, Table as TableIcon,
  Minus, Undo2, Redo2, Type,
} from 'lucide-react';
import { Collaboration } from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import SlashCommand, { slashSuggestion } from './slashCommand';

interface CollaborationUser { name: string; color: string; }

interface EditorProps {
  content: string;
  onUpdate: (html: string) => void;
  editable?: boolean;
  ydoc?: Y.Doc;
  collaborationUser?: CollaborationUser;
}

function ToolbarButton({
  onClick, isActive, tooltip, children,
}: {
  onClick: () => void;
  isActive?: boolean;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      type="button"
      className={`flex items-center justify-center w-8 h-8 min-w-[36px] min-h-[36px] rounded-md text-sm font-medium transition-all duration-150 ${
        isActive
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />;
}

export default function Editor({ content, onUpdate, editable = true, ydoc, collaborationUser: _collaborationUser }: EditorProps) {
  const [isMounted, setIsMounted] = useState(false);

  // 800ms debounce avoids a save API call on every keystroke while still feeling responsive
  const handleUpdate = useMemo(
    () => debounce((html: string) => { onUpdate(html); }, 800),
    [onUpdate]
  );

  // isMounted prevents TipTap from running during SSR — it depends on DOM APIs that don't exist server-side
  useEffect(() => { setIsMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const extensions = useMemo(() => [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SlashCommand.configure({ suggestion: slashSuggestion as any }),
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Disable StarterKit's bundled versions so our explicit imports below
      // (with custom config) are the sole registered instances.
      link: false,
      underline: false,
      // Yjs maintains its own undo/redo stack; keeping StarterKit's history alongside it causes conflicts
      ...(ydoc ? { history: false } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
    Placeholder.configure({ placeholder: "Type '/' for commands, or start writing..." }),
    Highlight,
    Underline,
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    ...(ydoc ? [
      Collaboration.configure({ document: ydoc }),
    ] : []),
  ], [ydoc]);

  const editor = useEditor({
    // immediatelyRender: false prevents a SSR/CSR hydration mismatch since TipTap's output differs server vs browser
    immediatelyRender: false,
    extensions,
    content,
    editable,
    onUpdate: ({ editor }) => { handleUpdate(editor.getHTML()); },
    editorProps: {
      attributes: {
        class: 'prose prose-gray prose-base focus:outline-none max-w-none min-h-[400px] leading-relaxed',
      },
    },
  });

  // Sync content on external changes (e.g. file import) — emitUpdate:false prevents the change from
  // triggering the debounced save, which would immediately overwrite the just-imported content
  useEffect(() => {
    if (editor && !editor.isFocused && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!isMounted || !editor) {
    return (
      <div className="flex flex-col h-full animate-pulse">
        <div className="h-12 bg-gray-50 border-b border-gray-200" />
        <div className="flex-1 bg-white" />
      </div>
    );
  }

  const toggleLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-col w-full h-full">

      {/* ── Sticky Toolbar ── */}
      {editable && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 px-3 py-2 bg-white border-b border-gray-200 shadow-sm">
          {/* Undo / Redo */}
          <ToolbarButton tooltip="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 size={15} />
          </ToolbarButton>

          <Divider />

          {/* Headings */}
          <ToolbarButton tooltip="Heading 1" isActive={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Heading 2" isActive={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Heading 3" isActive={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Normal text" isActive={editor.isActive('paragraph')}
            onClick={() => editor.chain().focus().setParagraph().run()}>
            <Type size={15} />
          </ToolbarButton>

          <Divider />

          {/* Inline marks */}
          <ToolbarButton tooltip="Bold (Ctrl+B)" isActive={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Italic (Ctrl+I)" isActive={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Underline (Ctrl+U)" isActive={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Strikethrough" isActive={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Highlight" isActive={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleHighlight().run()}>
            <Highlighter size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Inline Code" isActive={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}>
            <Code size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Link" isActive={editor.isActive('link')}
            onClick={toggleLink}>
            <LinkIcon size={15} />
          </ToolbarButton>

          <Divider />

          {/* Lists */}
          <ToolbarButton tooltip="Bullet List" isActive={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Numbered List" isActive={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Task List" isActive={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}>
            <CheckSquare size={15} />
          </ToolbarButton>

          <Divider />

          {/* Blocks */}
          <ToolbarButton tooltip="Blockquote" isActive={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote size={15} />
          </ToolbarButton>
          <span className="hidden sm:contents">
          <ToolbarButton tooltip="Code Block" isActive={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <span className="text-xs font-mono font-bold">{`</>`}</span>
          </ToolbarButton>
          </span>
          <ToolbarButton tooltip="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus size={15} />
          </ToolbarButton>
          <span className="hidden sm:contents">
          <ToolbarButton tooltip="Insert table"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <TableIcon size={15} />
          </ToolbarButton>
          </span>
        </div>
      )}

      {/* ── Dark Bubble Menu (appears on text selection) ── */}
      {editor && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700"
        >
          {[
            { label: <Bold size={14} />, action: 'bold', run: () => editor.chain().focus().toggleBold().run() },
            { label: <Italic size={14} />, action: 'italic', run: () => editor.chain().focus().toggleItalic().run() },
            { label: <UnderlineIcon size={14} />, action: 'underline', run: () => editor.chain().focus().toggleUnderline().run() },
            { label: <Strikethrough size={14} />, action: 'strike', run: () => editor.chain().focus().toggleStrike().run() },
          ].map(({ label, action, run }) => (
            <button key={action} onClick={run} type="button"
              className={`p-1.5 rounded-md transition-colors ${editor.isActive(action) ? 'bg-white text-gray-900' : 'hover:bg-gray-700 text-gray-200'}`}>
              {label}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-600 mx-0.5" />
          <button onClick={() => editor.chain().focus().toggleHighlight().run()} type="button"
            className={`p-1.5 rounded-md transition-colors ${editor.isActive('highlight') ? 'bg-yellow-400 text-gray-900' : 'hover:bg-gray-700 text-gray-200'}`}>
            <Highlighter size={14} />
          </button>
          <button onClick={toggleLink} type="button"
            className={`p-1.5 rounded-md transition-colors ${editor.isActive('link') ? 'bg-white text-gray-900' : 'hover:bg-gray-700 text-gray-200'}`}>
            <LinkIcon size={14} />
          </button>
          <button onClick={() => editor.chain().focus().toggleCode().run()} type="button"
            className={`p-1.5 rounded-md transition-colors ${editor.isActive('code') ? 'bg-white text-gray-900' : 'hover:bg-gray-700 text-gray-200'}`}>
            <Code size={14} />
          </button>
        </BubbleMenu>
      )}

      {/* ── Editor Content Area ── */}
      <div
        className="flex-1 overflow-y-auto cursor-text"
        onClick={() => editor?.chain().focus().run()}
      >
        <div className="max-w-3xl mx-auto px-8 py-8">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
