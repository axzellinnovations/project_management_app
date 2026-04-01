'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../types';
import { Flag, User, Calendar, Trash2, Edit2 } from 'lucide-react';

interface KanbanCardProps {
  task: Task;
  onDelete?: (taskId: number) => void;
  onEdit?: (task: Task) => void;
}

export default function KanbanCard({ task, onDelete, onEdit }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id.toString(),
    data: { type: 'task', taskId: task.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  // Get priority color
  const getPriorityColor = (priority?: string) => {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'LOW':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  // Get initials from assignee name
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const dueDateFormatted = formatDate(task.dueDate);
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'DONE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        rounded-lg border border-gray-200 bg-white p-3 shadow-sm
        hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing
        ${isDragging ? 'ring-2 ring-blue-400' : ''}
      `}
    >
      {/* Title */}
      <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-2">
        {task.title}
      </p>

      {/* Due Date */}
      {dueDateFormatted && (
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
          <Calendar size={13} className={isOverdue ? 'text-red-500' : 'text-gray-400'} />
          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
            {dueDateFormatted}
          </span>
        </div>
      )}

      {/* Story Points Badge */}
      {task.storyPoint && task.storyPoint > 0 && (
        <div className="inline-block px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700 mb-2">
          {task.storyPoint}
        </div>
      )}

      {/* Action Buttons */}
      {(onEdit || onDelete) && (
        <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-gray-100">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              title="Edit task"
            >
              <Edit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete task"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
