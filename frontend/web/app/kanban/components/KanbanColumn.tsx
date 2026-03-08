'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Task, KanbanColumn as KanbanColumnType } from '../types';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  column: KanbanColumnType;
  onDeleteTask?: (taskId: number) => void;
}

export default function KanbanColumn({
  column,
  onDeleteTask,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.status,
    data: { type: 'column', columnStatus: column.status },
  });

  const taskIds = column.tasks.map((task) => task.id.toString());

  return (
    <div className="flex flex-col h-full min-w-80 rounded-lg bg-gray-50 border border-gray-200">
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">{column.title}</h3>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-sm font-medium">
            {column.tasks.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.length > 0 ? (
            column.tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onDelete={onDeleteTask}
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <p className="text-sm">No tasks in this column</p>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
