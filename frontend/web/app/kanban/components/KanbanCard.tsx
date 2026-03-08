'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../types';
import { Flag, User, Calendar, Trash2 } from 'lucide-react';

interface KanbanCardProps {
  task: Task;
  onDelete?: (taskId: number) => void;
}

export default function KanbanCard({ task, onDelete }: KanbanCardProps) {
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

      {/* Priority Badge */}
      {task.priority && (
        <div className="flex items-center gap-1 mb-2">
          <Flag size={14} className={getPriorityColor(task.priority)} />
          <span
            className={`
              inline-block text-xs px-2 py-1 rounded-full font-medium
              ${getPriorityColor(task.priority)}
            `}
          >
            {task.priority}
          </span>
        </div>
      )}

      {/* Due Date */}
      {dueDateFormatted && (
        <div className="flex items-center gap-2 text-xs mb-2">
          <Calendar size={13} className={isOverdue ? 'text-red-500' : 'text-gray-400'} />
          <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
            {dueDateFormatted}
            {isOverdue && ' (Overdue)'}
          </span>
        </div>
      )}

      {/* Assignee Avatar */}
      {task.assigneeName && (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-semibold">
            {getInitials(task.assigneeName)}
          </div>
          <span className="text-gray-600 truncate">{task.assigneeName}</span>
        </div>
      )}

      {/* Story Points Badge */}
      {task.storyPoint && task.storyPoint > 0 && (
        <div className="mt-2 inline-block px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
          {task.storyPoint} pts
        </div>
      )}

      {/* Subtasks Count */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mt-2 text-xs text-gray-600">
          {task.subtasks.filter((st) => st.status === 'DONE').length}/
          {task.subtasks.length} subtasks
        </div>
      )}

      {/* Delete Button */}
      {onDelete && (
        <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-gray-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete task"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
