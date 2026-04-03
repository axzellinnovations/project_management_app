'use client';

import React from 'react';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../types';
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
  const completedSubtasks = task.subtasks?.filter((s) => s.status === 'DONE').length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

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

      {/* Assignee + Subtask row */}
      {(task.assigneeName || totalSubtasks > 0) && (
        <div className="flex items-center justify-between mt-2">
          {task.assigneeName ? (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={task.assigneeName} width={20} height={20} className="w-full h-full object-cover" unoptimized />
                ) : (
                  task.assigneeName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-[11px] text-gray-500 truncate max-w-[80px]">{task.assigneeName}</span>
            </div>
          ) : <span />}
          {totalSubtasks > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500 font-medium">{completedSubtasks}/{totalSubtasks}</span>
              <div className="w-14 h-1 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }} />
              </div>
            </div>
          )}
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
