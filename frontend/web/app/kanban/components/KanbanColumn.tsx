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
  onCreateTask?: (columnStatus: string) => void;
}

export default function KanbanColumn({
  column,
  onDeleteTask,
  onCreateTask,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.status,
    data: { type: 'column', columnStatus: column.status },
  });

  // Get column background color based on status
  const getColumnBgColor = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'bg-blue-50';
      case 'IN_PROGRESS':
        return 'bg-yellow-50';
      case 'IN_REVIEW':
        return 'bg-pink-50';
      case 'DONE':
        return 'bg-green-50';
      default:
        return 'bg-gray-50';
    }
  };

  const taskIds = column.tasks.map((task) => task.id.toString());

  return (
    <div className={`flex flex-col h-[calc(100%-38px)] min-w-80 rounded-lg border border-gray-200 ${getColumnBgColor(column.status)}`}>
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 text-sm">{column.title}</h3>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">
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
              <p className="text-xs">No tasks</p>
            </div>
          )}
        </SortableContext>
      </div>

      {/* Create Task Button */}
      {onCreateTask && (
        <div className="border-t border-gray-200 p-3 bg-white rounded-b-lg">
          <button
            onClick={() => onCreateTask(column.status)}
            className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded py-2 transition-colors"
          >
            + Create
          </button>
        </div>
      )}
    </div>
  );
}
