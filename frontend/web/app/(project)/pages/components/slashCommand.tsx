import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { 
  Heading1, Heading2, Heading3, 
  List, ListOrdered, CheckSquare, 
  Code, Quote, Table 
} from 'lucide-react';

interface CommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  command: (props: { editor: any; range: any }) => void;
}

const getSuggestionItems = ({ query }: { query: string }): CommandItem[] => {
  return [
    {
      title: 'Heading 1',
      description: 'Big section heading.',
      icon: <Heading1 size={18} />,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: ({ editor, range }: { editor: any; range: any }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading.',
      icon: <Heading2 size={18} />,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: ({ editor, range }: { editor: any; range: any }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading.',
      icon: <Heading3 size={18} />,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: ({ editor, range }: { editor: any; range: any }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
      },
    },
    {
      title: 'Bullet List',
      description: 'Create a simple bulleted list.',
      icon: <List size={18} />,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: ({ editor, range }: { editor: any; range: any }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: 'Numbered List',
      description: 'Create a list with numbering.',
      icon: <ListOrdered size={18} />,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: ({ editor, range }: { editor: any; range: any }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: 'To-do List',
      description: 'Track tasks with a to-do list.',
      icon: <CheckSquare size={18} />,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: ({ editor, range }: { editor: any; range: any }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: 'Quote',
      description: 'Capture a quote.',
      icon: <Quote size={18} />,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: ({ editor, range }: { editor: any; range: any }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: 'Code',
      description: 'Capture a code snippet.',
      icon: <Code size={18} />,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: ({ editor, range }: { editor: any; range: any }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: 'Table',
      description: 'Insert a 3x3 table.',
      icon: <Table size={18} />,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      command: ({ editor, range }: { editor: any; range: any }) => {
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      },
    },
  // slice(0, 10) caps the list so the dropdown stays usable; nobody needs more than 10 block types visible at once
  ].filter(item => item.title.toLowerCase().startsWith(query.toLowerCase())).slice(0, 10);
};

// forwardRef + useImperativeHandle are required because the Tiptap Suggestion plugin calls
// onKeyDown imperatively on this component — it can't use the standard React event system
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CommandList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback(
    (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command(item);
      }
    },
    [props]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }

      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }

      return false;
    },
  }));

  if (!props.items.length) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden min-w-[280px] max-h-[320px] overflow-y-auto">
      <div className="text-xs font-medium text-gray-500 px-3 py-2 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
        Basic blocks
      </div>
      <div className="p-1">
        {props.items.map((item: CommandItem, index: number) => (
          <button
            className={`flex items-center gap-3 w-full text-left px-2 py-2 rounded-md transition-colors ${
              index === selectedIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-100'
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <div className={`flex items-center justify-center w-10 h-10 rounded border ${index === selectedIndex ? 'bg-white border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-700'}`}>
              {item.icon}
            </div>
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

CommandList.displayName = 'CommandList';

export default Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const slashSuggestion = {
  items: getSuggestionItems,
  render: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let component: ReactRenderer<any>;
    let popup: TippyInstance[];

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onStart: (props: any) => {
        component = new ReactRenderer(CommandList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          // appendTo document.body escapes any parent CSS stacking context that would clip or hide the dropdown
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onUpdate(props: any) {
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }

        return component.ref?.onKeyDown(props);
      },

      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  },
};
