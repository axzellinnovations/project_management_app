'use client';

import React, { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableColumnProps {
  column: { status: string };
  children: ReactNode;
  width?: string;
}

/**
 * Wrapper that makes a column reorderable via drag-and-drop.
 * IMPORTANT: listeners are ONLY on the drag-handle (grip icon), NOT on the whole
 * wrapper div. This ensures the droppable zone inside the column is not blocked
 * by the sortable/draggable listeners — cards can be dropped onto any column.
 */
export default function SortableColumn({ column, children, width = '320px' }: SortableColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.status,
    data: { type: 'column' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    minHeight: '100%',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex-shrink-0 self-start relative group/col snap-center md:snap-none w-[88vw] sm:w-[320px] max-w-[320px]`}
      suppressHydrationWarning={true}
    >
      {/* Column reorder drag handle — only this element has the drag listeners */}
      <div
        {...attributes}
        {...listeners}
        suppressHydrationWarning={true}
        className="absolute top-2 left-0.5 z-10 opacity-0 group-hover/col:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-gray-200/60"
        title="Drag to reorder columns"
      >
        <GripVertical size={14} className="text-gray-400" />
      </div>
      {children}
    </div>
  );
}
