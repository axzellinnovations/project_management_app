'use client';

import React from 'react';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Subtask } from '../../(project)/kanban/types';
import { Calendar, Trash2, Edit2 } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

function resolveUrl(url?: string | null) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url}`;
}

interface KanbanCardProps {
  task: Task;
  onDelete?: (taskId: number) => void;
  onEdit?: (task: Task) => void;
  onOpenTask?: (taskId: number) => void;
  usersMap?: Record<string, string | null>;
}

export default function KanbanCard({ task, onDelete, onEdit, onOpenTask, usersMap }: KanbanCardProps) {
  const avatarUrl = task.assigneeName ? resolveUrl(usersMap?.[task.assigneeName] ?? null) : null;
  const completedSubtasks = task.subtasks?.filter((s: Subtask) => s.status === 'DONE').length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  const priorityStyle: Record<string, { dot: string; text: string; bg: string }> = {
    URGENT: { dot: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' },
    HIGH: { dot: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50' },
    MEDIUM: { dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50' },
    LOW: { dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-100' },
  };
  const pStyle = task.priority ? (priorityStyle[task.priority] ?? priorityStyle.LOW) : null;

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
      onClick={() => !isDragging && onOpenTask && onOpenTask(task.id)}
      className={`
        rounded-lg border border-gray-200 bg-white p-3 sm:p-3.5 shadow-sm
        hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing
        ${isDragging ? 'ring-2 ring-blue-400' : ''}
      `}
    >
      {/* Priority badge */}
      {pStyle && task.priority && (
        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1.5 ${pStyle.text} ${pStyle.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} />
          {task.priority}
        </div>
      )}

      {/* Title */}
      <p className="text-sm sm:text-[15px] font-medium text-gray-800 line-clamp-2 mb-2 leading-snug break-words">
        {task.title}
      </p>

      {/* Due Date */}
      {dueDateFormatted && (
        <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-600 mb-2 min-w-0">
          <Calendar size={13} className={`flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
            {dueDateFormatted}
          </span>
        </div>
      )}

      {/* Story Points Badge */}
      {task.storyPoint && task.storyPoint > 0 && (
        <div className="inline-block px-2 py-1 rounded text-[11px] sm:text-xs font-semibold bg-blue-100 text-blue-700 mb-2">
          {task.storyPoint}
        </div>
      )}

      {/* Assignee + Subtask row */}
      {(task.assigneeName || totalSubtasks > 0) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-2 min-w-0">
          {task.assigneeName ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={task.assigneeName} width={20} height={20} className="w-full h-full object-cover" unoptimized />
                ) : (
                  task.assigneeName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-[11px] sm:text-xs text-gray-500 truncate max-w-[120px] sm:max-w-[80px]">
                {task.assigneeName}
              </span>
            </div>
          ) : <span />}
          {totalSubtasks > 0 && (
            <div className="flex items-center gap-1 min-w-0 sm:justify-end">
              <span className="text-[10px] sm:text-xs text-gray-500 font-medium whitespace-nowrap">
                {completedSubtasks}/{totalSubtasks}
              </span>
              <div className="w-16 sm:w-14 h-1 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {(onEdit || onDelete) && (
        <div className="flex flex-wrap justify-end gap-1 mt-2 pt-2 border-t border-gray-100">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-md hover:bg-blue-50"
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
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
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
